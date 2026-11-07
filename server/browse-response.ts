import { defineMiddleware } from 'nitro';
import { guardBrowseResponse } from '../lib/catalog/browse-response';

// Supported Nitro/H3 response middleware; the original framework renderer and
// its separate RSC build remain unchanged. Only Browse HTML is inspected.
export default defineMiddleware(async (event, next) => {
  const response = await next();
  return response instanceof Response ? guardBrowseResponse(event.req, response) : response;
});
