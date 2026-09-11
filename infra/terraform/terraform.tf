terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Local state by default (local-first principle).
  # To use Cloudflare R2 remote state backend (SDD §12.3):
  # backend "s3" {
  #   bucket                      = "vp-terraform-state"
  #   key                         = "video-pipeline.tfstate"
  #   region                      = "auto"
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_metadata_api_check     = true
  #   skip_s3_checksum            = true
  #   endpoints = {
  #     s3 = "https://<account_id>.r2.cloudflarestorage.com"
  #   }
  # }
}
