'use strict';
/** Composes the Express application from its routers. Dependencies are injected for testability. */
const path = require('path');
const express = require('express');
const { securityHeaders, language, requireAuth, errorHandler, publicProfile } = require('./http');
const { AppError } = require('./validate');
const { createAI } = require('./ai');
const { createOAuth } = require('./oauth');
const accessRoutes = require('./routes/access');
const careRoutes = require('./routes/care');
const assistantRoutes = require('./routes/assistant');

/**
 * Compose the Express app from injected services so tests can swap storage, mail, AI and OAuth.
 * @param {{ store: object, mailer: object, ai?: object, oauth?: object }} deps
 * @returns {import('express').Express}
 */
function createApp({ store, mailer, ai = createAI(), oauth = createOAuth() }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(language);
  app.use(express.json({ limit: '64kb' }));

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { maxAge: '1h', index: 'index.html' }));

  app.get('/healthz', (req, res) => res.json({ ok: true, storage: store.kind }));

  const deps = { store, mailer, ai, oauth, auth: requireAuth(store) };
  app.use(accessRoutes(deps));
  app.use(careRoutes(deps));
  app.use(assistantRoutes(deps));

  app.use('/api', (req, res, next) => next(new AppError('notFound', {}, 404)));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, publicProfile };
