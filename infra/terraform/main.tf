# =============================================================================
# Data Sources
# =============================================================================

data "cloudflare_zone" "primary" {
  name = var.domain
}

# =============================================================================
# 1. Cloudflare R2 Buckets & Custom Domain (SDD §7, §16.4, ADR-06)
# =============================================================================

# Raw bucket: holds uploaded originals; strictly private; 7-day retention rule
resource "cloudflare_r2_bucket" "raw" {
  account_id = var.cloudflare_account_id
  name       = "vp-raw"
  location   = "WEUR"
}

# Lifecycle rule for raw bucket: abort incomplete multiparts after 1d, expire objects after 7d
resource "cloudflare_r2_bucket_lifecycle" "raw" {
  account_id = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.raw.name

  rules {
    id      = "raw-retention-and-abort-multipart"
    enabled = true

    abort_multipart_uploads_transition {
      condition {
        max_age = 86400 # 1 day in seconds
      }
    }

    expiration {
      condition {
        max_age = var.raw_retention_days * 86400 # 7 days in seconds
      }
    }
  }
}

# Public bucket: holds transcoded HLS ladders, playlists, thumbnails
resource "cloudflare_r2_bucket" "public" {
  account_id = var.cloudflare_account_id
  name       = "vp-public"
  location   = "WEUR"
}

# Custom domain fronted by Cloudflare CDN for cdn.<domain> (never expose raw *.r2.dev)
resource "cloudflare_r2_custom_domain" "public_cdn" {
  account_id = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.public.name
  domain      = "cdn.${var.domain}"
  zone_id     = data.cloudflare_zone.primary.id
  enabled     = true
}

# =============================================================================
# 2. Cloudflare Zero Trust Tunnel & DNS (SDD §12.3, ADR-15)
# Exposes Traefik ingress on the VPS without opening any ingress ports on the host
# =============================================================================

resource "random_password" "tunnel_secret" {
  length  = 32
  special = false
}

resource "cloudflare_tunnel" "k3s_tunnel" {
  account_id = var.cloudflare_account_id
  name       = "vp-k3s-tunnel"
  secret     = base64encode(random_password.tunnel_secret.result)
}

# CNAME record routing api.<domain> to the Cloudflare Tunnel
resource "cloudflare_record" "api_tunnel" {
  zone_id = data.cloudflare_zone.primary.id
  name    = "api"
  value   = "${cloudflare_tunnel.k3s_tunnel.id}.cfargotunnel.com"
  type    = "CNAME"
  proxied = true
}

# Tunnel ingress routing configuration
resource "cloudflare_tunnel_config" "k3s_tunnel_config" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_tunnel.k3s_tunnel.id

  config {
    ingress_rule {
      hostname = "api.${var.domain}"
      service  = "http://localhost:80"
    }
    # Catch-all rule required by Cloudflare Tunnel
    ingress_rule {
      service = "http_status:404"
    }
  }
}

# =============================================================================
# 3. Cloudflare Zero Trust Access Policy for /admin (SDD §11, §15.3, Ticket 10)
# =============================================================================

resource "cloudflare_access_application" "admin_portal" {
  account_id                = var.cloudflare_account_id
  name                      = "Video Pipeline Admin"
  domain                    = "api.${var.domain}/admin"
  type                      = "self_hosted"
  session_duration          = "24h"
  auto_redirect_to_identity = false
}

resource "cloudflare_access_policy" "admin_allow_operator" {
  account_id     = var.cloudflare_account_id
  application_id = cloudflare_access_application.admin_portal.id
  name           = "Allow Operators"
  decision       = "allow"
  precedence     = 1

  include {
    email = [var.admin_email]
  }
}

# =============================================================================
# 4. Scoped R2 API Token Pair (API vs Worker permissions, SDD §11, §16.4)
# =============================================================================

# Token for apps/api: Read & Write on vp-raw (for presigned PUT and HeadObject verify)
resource "cloudflare_api_token" "r2_api_app" {
  name = "vp-api-r2-scoped"

  policy {
    permission_groups = [
      "Workers R2 Storage Bucket Item Write",
      "Workers R2 Storage Bucket Item Read"
    ]
    resources = {
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.raw.name}" = "*"
    }
  }
}

# Token for apps/worker: Read on vp-raw (source), Read & Write on vp-public (transcode outputs)
resource "cloudflare_api_token" "r2_worker_app" {
  name = "vp-worker-r2-scoped"

  policy {
    permission_groups = [
      "Workers R2 Storage Bucket Item Read"
    ]
    resources = {
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.raw.name}" = "*"
    }
  }

  policy {
    permission_groups = [
      "Workers R2 Storage Bucket Item Write",
      "Workers R2 Storage Bucket Item Read"
    ]
    resources = {
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.public.name}" = "*"
    }
  }
}

# =============================================================================
# 5. Hetzner Cloud VPS & Firewall (SDD §12.3, ADR-15)
# Compute for k3s cluster (CAX11 Arm64 or CX23 x86)
# =============================================================================

resource "hcloud_ssh_key" "operator_key" {
  name       = "vp-operator-key"
  public_key = var.hcloud_ssh_public_key
}

# Firewall: Zero inbound exposure except SSH restricted to operator's specific IP.
# All application traffic ingresses securely through the outbound Cloudflare Tunnel!
resource "hcloud_firewall" "vps_firewall" {
  name = "vp-k3s-firewall"

  # Allow inbound SSH strictly from configured operator IP CIDR
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = [
      var.operator_ssh_ip
    ]
    description = "SSH from operator IP only"
  }

  # Allow full outbound connectivity for tunnel, package mirrors, and external services
  rule {
    direction = "out"
    protocol  = "tcp"
    port      = "any"
    destination_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Outbound TCP"
  }

  rule {
    direction = "out"
    protocol  = "udp"
    port      = "any"
    destination_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
    description = "Outbound UDP (DNS/NTP)"
  }
}

# Server instance running Ubuntu 24.04
resource "hcloud_server" "k3s_node" {
  name        = "vp-${var.environment}-node"
  server_type = var.hcloud_server_type
  image       = "ubuntu-24.04"
  location    = var.hcloud_location
  ssh_keys    = [hcloud_ssh_key.operator_key.id]
  firewall_ids = [hcloud_firewall.vps_firewall.id]

  # Disable password authentication; SSH key only
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
