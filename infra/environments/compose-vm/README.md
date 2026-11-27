# compose-vm

One virtual machine running Docker Compose: Redis in the project, the API and every worker stage on one
replica each, Postgres on Neon and storage on R2 (or any S3), an optional `cloudflared` for the tunnel.
There is no KEDA, so stages do not scale; size the VM for the transcodes you expect.

```bash
docker context create vp-vm --docker "host=ssh://deploy@vm.example.com"
make secrets-check ENV=compose-vm
make deploy-plan ENV=compose-vm
make deploy ENV=compose-vm TAG=v1.2.3 YES=1
make deploy-rollback ENV=compose-vm
```

The deploy runs `docker compose` against the Docker context `vp-vm`, so nothing is copied to the VM but the
`.secrets/compose-vm.env` file, which compose sends as the containers' environment. Add `--profile tunnel`
through `COMPOSE_PROFILES=tunnel` to run `cloudflared`. Web and studio are not in this file for the reason
the cloud overlay leaves them out: the published images carry no public API URL.
