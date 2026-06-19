/**
 * Auth middleware for Fastify.
 *
 * Registers two decorators on the fastify instance:
 *   fastify.authenticate       — requires a valid JWT, attaches req.user
 *   fastify.authenticateOptional — attaches req.user if token present, else null
 *
 * JWT payload shape: { sub: userId, email, username, iat, exp }
 */

export async function authPlugin(fastify) {
  // @fastify/jwt must be registered on the root instance before this plugin.
  // It is registered in src/index.js.

  fastify.decorate('authenticate', async function (req, reply) {
    try {
      await req.jwtVerify();
      // Attach a clean user object
      req.user = {
        id:       req.user.sub,
        email:    req.user.email,
        username: req.user.username,
      };
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: err.message });
    }
  });

  fastify.decorate('authenticateOptional', async function (req) {
    try {
      await req.jwtVerify();
      req.user = {
        id:       req.user.sub,
        email:    req.user.email,
        username: req.user.username,
      };
    } catch {
      req.user = null;
    }
  });
}
