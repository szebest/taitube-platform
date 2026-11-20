/**
 * Each script runs atomically on the server. `record` must not count a viewer the dedup sketch
 * already holds, and `snapshot` must move every buffer and point at the batch in one step: split
 * either across round trips and a concurrent beacon or a crashed flush loses or doubles a view.
 * `recordPlayback` credits the share link and the test variant its caller names in the same step,
 * so a second of watch time is never on the video without being on them.
 */
export const VIEW_BUFFER_SCRIPTS = {
  record: `
local added = redis.call('PFADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[2], ARGV[3], 1)
  redis.call('HINCRBY', KEYS[3], ARGV[4], 1)
end
return added`,
  recordPlayback: `
local watched = tonumber(redis.call('HINCRBYFLOAT', KEYS[1], 'watched', ARGV[4]))
local credited = tonumber(redis.call('HGET', KEYS[1], 'credited') or '0')
local whole = math.floor(watched)
if whole > credited then
  local seconds = whole - credited
  redis.call('HINCRBY', KEYS[3], ARGV[3], seconds)
  if ARGV[9] ~= '' then redis.call('HINCRBY', KEYS[3], ARGV[9], seconds) end
  if ARGV[11] ~= '' then redis.call('HINCRBY', KEYS[3], ARGV[11], seconds) end
  redis.call('HSET', KEYS[1], 'credited', whole)
end
redis.call('EXPIRE', KEYS[1], ARGV[2])
if watched < tonumber(ARGV[5]) then return -1 end
if redis.call('HSETNX', KEYS[1], 'counted', 1) == 0 then return -1 end
local added = redis.call('PFADD', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[3], ARGV[6], 1)
  redis.call('HINCRBY', KEYS[3], ARGV[8], 1)
  if ARGV[10] ~= '' then redis.call('HINCRBY', KEYS[3], ARGV[10], 1) end
  redis.call('HINCRBY', KEYS[4], ARGV[7], 1)
end
return added`,
  recordShareLinkOpen: `
local added = redis.call('PFADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[2], ARGV[3], 1)
end
return added`,
  snapshot: `
local pending = redis.call('GET', KEYS[1])
if pending then return pending end
local views = redis.call('EXISTS', KEYS[2])
local retention = redis.call('EXISTS', KEYS[4])
local hourly = redis.call('EXISTS', KEYS[6])
if views == 0 and retention == 0 and hourly == 0 then return false end
if views == 1 then redis.call('RENAME', KEYS[2], KEYS[3]) end
if retention == 1 then redis.call('RENAME', KEYS[4], KEYS[5]) end
if hourly == 1 then redis.call('RENAME', KEYS[6], KEYS[7]) end
redis.call('SET', KEYS[1], ARGV[1])
return ARGV[1]`,
  recordRetention: `
local last = redis.call('GET', KEYS[1])
local target = tonumber(ARGV[1])
local step = tonumber(ARGV[2])
local first = 0
if last then
  first = tonumber(last) + step
end
for percent = first, target, step do
  redis.call('HINCRBY', KEYS[2], ARGV[4] .. '|' .. percent, 1)
end
if (not last) or tonumber(last) < target then
  redis.call('SET', KEYS[1], target)
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`,
  release: `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2], KEYS[3], KEYS[4])
  return 1
end
return 0`,
} as const;
