import type { FastifyRequest } from 'fastify';
import type { PartyCaller } from '../services/watch-party/party-caller';

/** The caller every watch party route hands its service: the session, the party credential, the IP. */
export function partyCallerOf(request: FastifyRequest): PartyCaller {
  return { user: request.user, party: request.party, ip: request.ip };
}
