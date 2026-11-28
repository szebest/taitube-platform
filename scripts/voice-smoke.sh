#!/usr/bin/env bash
set -euo pipefail

# Takes the compose files the stack was started with, the offline override among them, with the API running
# WATCH_PARTY_VOICE_ENABLED=true and the voice profile up. Proves LiveKit is off by default and has no egress,
# that the API mints grants that follow the roles, and that LiveKit itself drops a muted speaker's publish rights.

args=()
for file in "$@"; do args+=(-f "$file"); done

compose() { docker compose "${args[@]}" --profile '*' "$@"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

OWNER_SUB="00000000-0000-7000-8000-000000000001"
MEMBER_SUB="00000000-0000-7000-8000-000000000002"
MEMBER_KEY="user:$MEMBER_SUB"
MUTE_DEADLINE_SEC="${MUTE_DEADLINE_SEC:-5}"

pick() {
  node -e '
    let text = "";
    process.stdin.on("data", (chunk) => (text += chunk)).on("end", () => {
      const value = process.argv[1].split(".").reduce((object, key) => object?.[key], JSON.parse(text));
      process.stdout.write(value === undefined ? "" : String(value));
    });
  ' "$1"
}

claims() {
  node -e '
    const payload = process.argv[1].split(".")[1];
    const { video = {}, metadata = "" } = JSON.parse(Buffer.from(payload, "base64url").toString());
    process.stdout.write(`${video.canSubscribe === true}:${video.canPublish === true}:${metadata}`);
  ' "$1"
}

mint() { pnpm --silent dev-token mint --sub "$1" --role "$2" --ttl 1h --raw; }

call() {
  local token=$1 method=$2 route=$3 body=${4:-'{}'}
  compose exec -T api curl -sS --max-time 10 -X "$method" "http://localhost:3000$route" \
    -H "Authorization: Bearer $token" -H 'content-type: application/json' -d "$body"
}

lk() { compose run --rm --no-deps -T lk "$@"; }

participant() {
  lk room participants list --json "$ROOM" | node -e '
    let text = "";
    process.stdin.on("data", (chunk) => (text += chunk)).on("end", () => {
      const find = (value) => {
        if (value === null || typeof value !== "object") return undefined;
        if (value.identity === process.argv[1]) return value;
        for (const child of Object.values(value)) {
          const found = find(child);
          if (found) return found;
        }
        return undefined;
      };
      const found = find(JSON.parse(text));
      process.stdout.write(found ? `${found.permission?.canPublish === true}:${(found.tracks ?? []).length}` : "absent");
    });
  ' "$MEMBER_KEY"
}

echo "==> The default stack starts no media server"
if docker compose "${args[@]}" config --services | grep -qx livekit; then
  fail "livekit starts without the voice profile"
fi

echo "==> LiveKit has no route out: every network it sits on is internal"
livekit_id=$(compose ps -q livekit)
[ -n "$livekit_id" ] || fail "livekit is not running"
for network in $(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$livekit_id"); do
  [ "$(docker network inspect -f '{{.Internal}}' "$network")" = "true" ] || fail "livekit sits on $network, which has a route out"
done
if compose logs livekit | grep -Eiq 'stun\.|stun:|external ip|public ip'; then
  fail "livekit looked for an address outside the compose network"
fi

OWNER_TOKEN=$(mint "$OWNER_SUB" creator)
MEMBER_TOKEN=$(mint "$MEMBER_SUB" user)

echo "==> Create a party and seat a second member"
PARTY=$(call "$OWNER_TOKEN" POST /v1/watch-parties '{"visibility":"unlisted","preset":"friends"}')
PARTY_ID=$(printf '%s' "$PARTY" | pick id)
[ -n "$PARTY_ID" ] || fail "no party was created: $PARTY"
ROOM="party:$PARTY_ID"
call "$MEMBER_TOKEN" POST "/v1/watch-parties/$PARTY_ID/join" >/dev/null

echo "==> Tokens carry the grants the roles give"
SPEAKER=$(call "$MEMBER_TOKEN" POST "/v1/watch-parties/$PARTY_ID/voice/token")
[ "$(printf '%s' "$SPEAKER" | pick canSpeak)" = "true" ] || fail "a friends-room member did not get a speaker token: $SPEAKER"
[ "$(claims "$(printf '%s' "$SPEAKER" | pick token)")" = 'true:true:{"speak":true}' ] || fail "the speaker token grants are wrong"
LISTENER=$(call "$MEMBER_TOKEN" POST "/v1/watch-parties/$PARTY_ID/voice/token" '{"listenOnly":true}')
[ "$(printf '%s' "$LISTENER" | pick canSpeak)" = "false" ] || fail "a listener token can speak: $LISTENER"
[ "$(claims "$(printf '%s' "$LISTENER" | pick token)")" = 'true:false:{"speak":false}' ] || fail "the listener token grants are wrong"

echo "==> A speaker publishes through LiveKit"
compose run -d --no-deps --name voice-smoke-speaker lk room join --identity "$MEMBER_KEY" --publish-demo "$ROOM" >/dev/null
trap 'docker rm -f voice-smoke-speaker >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do
  [ "$(participant)" = "true:1" ] && break
  sleep 1
done
[ "$(participant)" = "true:1" ] || fail "the speaker never published: $(participant)"

echo "==> Voice muted takes the grant away inside LiveKit within ${MUTE_DEADLINE_SEC}s"
ROLE_ID=$(call "$OWNER_TOKEN" GET "/v1/watch-parties/$PARTY_ID/roles" | node -e '
  let text = "";
  process.stdin.on("data", (chunk) => (text += chunk)).on("end", () => {
    process.stdout.write(JSON.parse(text).items.find((role) => role.key === "voice_muted")?.id ?? "");
  });
')
[ -n "$ROLE_ID" ] || fail "the room has no Voice muted role"
call "$OWNER_TOKEN" POST "/v1/watch-parties/$PARTY_ID/members/$MEMBER_KEY/roles/$ROLE_ID" >/dev/null
for _ in $(seq 1 $((MUTE_DEADLINE_SEC * 2))); do
  [ "$(participant)" = "false:0" ] && break
  sleep 0.5
done
[ "$(participant)" = "false:0" ] || fail "LiveKit still lets the muted member publish: $(participant)"

echo "Verified: voice is off by default, LiveKit has no egress, tokens follow the roles and a mute is enforced in the SFU."
