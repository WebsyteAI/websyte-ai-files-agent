import { tool } from 'ai';
import { z } from 'zod';

/**
 * Tool to test an HTTP endpoint.
 * Makes a request to the specified URL and returns the status code and response summary.
 */
export const testEndpoint = tool({
  description: 'Tests a given HTTP endpoint by making a request and returns the status code and response summary.',
  parameters: z.object({
    url: z.string().url().describe('The URL of the endpoint to test.'),
    method: z.string().optional().default('GET').describe('The HTTP method (GET, POST, PUT, DELETE, etc.). Defaults to GET.'),
    headers: z.record(z.string()).optional().describe('Optional headers to include in the request.'),
    body: z.string().optional().describe('Optional request body for methods like POST or PUT.'),
  }),
  execute: async ({ url, method, headers, body }) => {
    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: headers,
        body: body,
      });

      const responseBody = await response.text();
      const responseSummary = responseBody.length > 200 ? `${responseBody.substring(0, 200)}...` : responseBody;

      return {
        status: response.status,
        statusText: response.statusText,
        responseSummary: responseSummary,
      };
    } catch (error) {
      console.error(`Error testing endpoint ${url}:`, error);
      return {
        error: `Failed to test endpoint: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});