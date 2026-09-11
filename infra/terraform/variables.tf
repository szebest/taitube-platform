variable "admin_email" {
  description = "Email address allowed to access /admin via Cloudflare Zero Trust Access"
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID (32 hex characters)"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone DNS, R2 Storage, Tunnel, and Access permissions"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Base domain name managed in Cloudflare (e.g. example.com)"
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. cloud, staging, prod)"
  type        = string
  default     = "cloud"
}

variable "hcloud_location" {
  description = "Hetzner Cloud datacenter location (e.g. fsn1, nbg1, hel1)"
  type        = string
  default     = "fsn1"
}

variable "hcloud_server_type" {
  description = "Hetzner Cloud server type: cax11 (Arm64, €5.99/mo) or cx23 (x86, €5.49/mo)"
  type        = string
  default     = "cax11"

  validation {
    condition     = contains(["cax11", "cx23"], var.hcloud_server_type)
    error_message = "Server type must be cax11 (Arm64) or cx23 (x86)."
  }
}

variable "hcloud_ssh_public_key" {
  description = "SSH public key content for root access to the Hetzner VPS"
  type        = string
}

variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "operator_ssh_ip" {
  description = "Operator IPv4 CIDR allowed to SSH into the Hetzner server (e.g. 203.0.113.10/32)"
  type        = string
}

variable "raw_retention_days" {
  description = "Retention period in days for raw uploaded videos before automatic expiration"
  type        = number
  default     = 7
}
