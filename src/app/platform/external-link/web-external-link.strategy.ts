import { ExternalLinkTarget, IExternalLink } from './external-link.service';

/**
 * Web implementation: thin wrapper over `window.open` so call sites stay
 * identical to the native strategy. Mirrors what every component in the
 * codebase does today before this abstraction existed.
 *
 * `noopener,noreferrer` is added to `_blank` opens to prevent the new
 * tab from gaining `window.opener` access (XSS pivot vector).
 */
export class WebExternalLinkStrategy implements IExternalLink {
  async open(url: string, target: ExternalLinkTarget = '_blank'): Promise<void> {
    const features = target === '_blank' ? 'noopener,noreferrer' : '';
    window.open(url, target, features);
  }
}
