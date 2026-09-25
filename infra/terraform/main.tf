data "cloudflare_zone" "primary" {
  filter = {
    name = var.domain
  }
}

data "cloudflare_api_token_permission_groups_list" "r2_bucket" {
  scope = "com.cloudflare.edge.r2.bucket"
}

locals {
  r2_bucket_permission = {
    for group in data.cloudflare_api_token_permission_groups_list.r2_bucket.result : group.name => group.id
  }
}

resource "cloudflare_r2_bucket" "raw" {
  account_id = var.cloudflare_account_id
  name       = "vp-raw"
  location   = "WEUR"
}

resource "cloudflare_r2_bucket_lifecycle" "raw" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.raw.name

  rules = [{
    id         = "raw-retention-and-abort-multipart"
    enabled    = true
    conditions = { prefix = "" }

    abort_multipart_uploads_transition = {
      condition = { type = "Age", max_age = 86400 }
    }

    delete_objects_transition = {
      condition = { type = "Age", max_age = var.raw_retention_days * 86400 }
    }
  }]
}

resource "cloudflare_r2_bucket" "public" {
  account_id = var.cloudflare_account_id
  name       = "vp-public"
  location   = "WEUR"
}

resource "cloudflare_r2_custom_domain" "public_cdn" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.public.name
  domain      = "cdn.${var.domain}"
  zone_id     = data.cloudflare_zone.primary.zone_id
  enabled     = true
}

resource "random_bytes" "tunnel_secret" {
  length = 32
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "k3s_tunnel" {
  account_id    = var.cloudflare_account_id
  name          = "vp-k3s-tunnel"
  config_src    = "cloudflare"
  tunnel_secret = random_bytes.tunnel_secret.base64
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "k3s_tunnel" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.k3s_tunnel.id
}

resource "cloudflare_dns_record" "api_tunnel" {
  zone_id = data.cloudflare_zone.primary.zone_id
  name    = "api.${var.domain}"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.k3s_tunnel.id}.cfargotunnel.com"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "k3s_tunnel" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.k3s_tunnel.id

  config = {
    ingress = [
      {
        hostname = "api.${var.domain}"
        service  = "http://localhost:80"
      },
      {
        service = "http_status:404"
      },
    ]
  }
}

resource "cloudflare_zero_trust_access_policy" "admin_allow_operator" {
  account_id = var.cloudflare_account_id
  name       = "Allow Operators"
  decision   = "allow"

  include = [{
    email = { email = var.admin_email }
  }]
}

resource "cloudflare_zero_trust_access_application" "admin_portal" {
  account_id                = var.cloudflare_account_id
  name                      = "Video Pipeline Admin"
  domain                    = "api.${var.domain}/admin"
  type                      = "self_hosted"
  session_duration          = "24h"
  auto_redirect_to_identity = false

  policies = [{
    id         = cloudflare_zero_trust_access_policy.admin_allow_operator.id
    precedence = 1
  }]
}

resource "cloudflare_api_token" "r2_api_app" {
  name = "vp-api-r2-scoped"

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.r2_bucket_permission["Workers R2 Storage Bucket Item Read"] },
      { id = local.r2_bucket_permission["Workers R2 Storage Bucket Item Write"] },
    ]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.raw.name}" = "*"
    })
  }]
}

# Housekeeping deletes sources and aborts multipart uploads in vp-raw, and R2 grants a delete only
# with Item Write, so the worker writes to both buckets.
resource "cloudflare_api_token" "r2_worker_app" {
  name = "vp-worker-r2-scoped"

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.r2_bucket_permission["Workers R2 Storage Bucket Item Read"] },
      { id = local.r2_bucket_permission["Workers R2 Storage Bucket Item Write"] },
    ]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.raw.name}"    = "*"
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.public.name}" = "*"
    })
  }]
}

resource "hcloud_ssh_key" "operator_key" {
  name       = "vp-operator-key"
  public_key = var.hcloud_ssh_public_key
}

# Inbound is SSH from the operator only: application traffic arrives through the outbound tunnel.
resource "hcloud_firewall" "vps_firewall" {
  name = "vp-k3s-firewall"

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = [var.operator_ssh_ip]
    description = "SSH from operator IP only"
  }

  rule {
    direction       = "out"
    protocol        = "tcp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
    description     = "Outbound TCP"
  }

  rule {
    direction       = "out"
    protocol        = "udp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
    description     = "Outbound UDP (DNS/NTP)"
  }
}

resource "hcloud_server" "k3s_node" {
  name         = "vp-${var.environment}-node"
  server_type  = var.hcloud_server_type
  image        = "ubuntu-24.04"
  location     = var.hcloud_location
  ssh_keys     = [hcloud_ssh_key.operator_key.id]
  firewall_ids = [hcloud_firewall.vps_firewall.id]

  user_data = <<-EOF
    #cloud-config
    ssh_pwauth: false
    users:
      - name: root
        ssh_authorized_keys:
          - ${var.hcloud_ssh_public_key}
  EOF

  labels = {
    project     = "video-pipeline"
    environment = var.environment
    managed_by  = "terraform"
  }
}
