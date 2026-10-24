import { failure } from './server';
export const extensionHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};
export const extensionOptions = () =>
  new Response(null, { status: 204, headers: extensionHeaders });
export const extensionJson = (data: unknown) =>
  Response.json(data, { headers: extensionHeaders });
export async function extensionFailure(error: unknown) {
  const response = failure(error);
  return new Response(await response.text(), {
    status: response.status,
    headers: { ...extensionHeaders, 'Content-Type': 'application/json' },
  });
}
