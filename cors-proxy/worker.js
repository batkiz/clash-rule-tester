export default {
  async fetch(request, env, ctx) {
    // Extract the target URL from the query string
    const url = new URL(request.url).searchParams.get('url');

    if (!url) {
      return new Response('Bad request: Missing "url" query parameter', {
        status: 400
      });
    }

    // Create a new request to the target URL
    const newRequest = new Request(url, {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: 'follow'
    });

    // Fetch the target URL
    const response = await fetch(newRequest);

    // Create a new response with CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
       newResponse.headers.set('Access-Control-Allow-Headers', '*');

    return newResponse;
  },
};