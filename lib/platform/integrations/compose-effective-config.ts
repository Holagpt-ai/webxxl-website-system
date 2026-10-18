/**
 * Parses `docker compose config --format json` output for INFRA-02A isolation checks.
 */

export type ComposePortBinding = {
  published?: number | string
  target?: number
  host_ip?: string
  protocol?: string
}

export type ComposeServiceConfig = {
  container_name?: string
  image?: string
  ports?: Array<string | ComposePortBinding>
}

export type ComposeConfigJson = {
  name?: string
  services?: Record<string, ComposeServiceConfig>
}

export function parsePublishedHostIps(ports: ComposeServiceConfig['ports']): string[] {
  if (!ports?.length) return []
  const ips: string[] = []
  for (const entry of ports) {
    if (typeof entry === 'string') {
      const [host] = entry.split(':')
      ips.push(host.includes('.') ? host : '0.0.0.0')
      continue
    }
    if (entry.host_ip) ips.push(entry.host_ip)
    else if (entry.published !== undefined) ips.push('0.0.0.0')
  }
  return ips
}

export function assertLocalhostOrNoPublish(cfg: ComposeConfigJson, serviceName: string): string | null {
  const svc = cfg.services?.[serviceName]
  if (!svc?.ports?.length) return null
  for (const ip of parsePublishedHostIps(svc.ports)) {
    if (ip !== '127.0.0.1') {
      return `Service ${serviceName} publishes non-localhost binding: ${ip}`
    }
  }
  return null
}

export function assertNoFixedContainerNames(cfg: ComposeConfigJson): string | null {
  if (!cfg.services) return null
  for (const [name, svc] of Object.entries(cfg.services)) {
    if (svc.container_name) {
      return `Service ${name} still has container_name ${svc.container_name}`
    }
  }
  return null
}

export function assertNoRunnableBaseService(cfg: ComposeConfigJson): string | null {
  if (cfg.services?.base) return 'Chatwoot base service must not be runnable'
  return null
}
