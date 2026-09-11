output "api_endpoint" {
  description = "Public API endpoint routed through Cloudflare Tunnel"
  value       = "https://api.${var.domain}"
}

output "cdn_endpoint" {
  description = "Public CDN endpoint fronting Cloudflare R2 public bucket"
  value       = "https://cdn.${var.domain}"
}

output "cloudflare_tunnel_id" {
  description = "ID of the Cloudflare Tunnel"
  value       = cloudflare_tunnel.k3s_tunnel.id
}

output "cloudflare_tunnel_token" {
  description = "Secret token for running cloudflared connector on the VPS / k3s"
  value       = cloudflare_tunnel.k3s_tunnel.tunnel_token
  sensitive   = true
}

output "hetzner_server_id" {
  description = "ID of the created Hetzner server"
  value       = hcloud_server.k3s_node.id
}

output "hetzner_server_ip" {
  description = "Public IPv4 address of the Hetzner k3s VPS"
  value       = hcloud_server.k3s_node.ipv4_address
}

output "r2_api_token_id" {
  description = "API Token ID for apps/api (raw bucket read/write)"
  value       = cloudflare_api_token.r2_api_app.id
  sensitive   = true
}

output "r2_bucket_public" {
  description = "Name of the public R2 bucket"
  value       = cloudflare_r2_bucket.public.name
}

output "r2_bucket_raw" {
  description = "Name of the raw private R2 bucket"
  value       = cloudflare_r2_bucket.raw.name
}

output "r2_endpoint" {
  description = "S3-compatible endpoint for Cloudflare R2"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "r2_worker_token_id" {
  description = "API Token ID for apps/worker (raw bucket read, public bucket write)"
  value       = cloudflare_api_token.r2_worker_app.id
  sensitive   = true
}
