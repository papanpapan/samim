/** OpenAPI 3 document for SN-ERMS API (Swagger UI at /api/docs). */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SN-ERMS API',
    description: 'Saba Nursery Enterprise Resource & Smart Inventory Management System — Backend API v1.',
    version: '3.0.0',
  },
  servers: [
    { url: 'http://localhost:4000/api/v1', description: 'Local API' },
    { url: '/api/v1', description: 'Same host' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT from POST /auth/login (Authorization: Bearer <token>).',
      },
      nurseryHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Nursery-Id',
        description: 'Active nursery id (platform owner / multi-nursery sessions).',
      },
    },
    schemas: {
      ApiOk: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {},
        },
      },
      LoginBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { nurseryHeader: [] }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Public' },
    { name: 'Platform' },
    { name: 'Nursery' },
    { name: 'Mother plants' },
    { name: 'Propagation' },
    { name: 'Inventory' },
    { name: 'Sales' },
    { name: 'Vermicompost' },
    { name: 'Care' },
    { name: 'Distribution' },
    { name: 'Reports' },
    { name: 'Smart / Alerts' },
    { name: 'Live camera' },
    { name: 'Expenses' },
    { name: 'Audit' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Sign in',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } },
        },
        responses: { 200: { description: 'JWT + user' } },
      },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user', responses: { 200: { description: 'User profile' } } },
    },
    '/auth/users': {
      get: { tags: ['Auth'], summary: 'List nursery users', responses: { 200: { description: 'Users' } } },
      post: { tags: ['Auth'], summary: 'Create nursery user', responses: { 201: { description: 'Created' } } },
    },
    '/public/plants/{code}': {
      get: {
        tags: ['Public'],
        security: [],
        summary: 'Public mother plant page',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Plant' } },
      },
    },
    '/public/batches/{code}': {
      get: {
        tags: ['Public'],
        security: [],
        summary: 'Public batch',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Batch' } },
      },
    },
    '/public/stock/{code}': {
      get: {
        tags: ['Public'],
        security: [],
        summary: 'Public stock item',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Stock' } },
      },
    },
    '/public/alerts/{code}': {
      get: {
        tags: ['Public'],
        security: [],
        summary: 'Public danger alert case',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Alert case' } },
      },
    },
    '/platform/nurseries': {
      get: { tags: ['Platform'], summary: 'List nurseries', responses: { 200: { description: 'Nurseries' } } },
      post: { tags: ['Platform'], summary: 'Onboard nursery', responses: { 201: { description: 'Created' } } },
    },
    '/platform/features': {
      get: { tags: ['Platform'], summary: 'Feature catalog', responses: { 200: { description: 'Features' } } },
    },
    '/platform/packages': {
      get: { tags: ['Platform'], summary: 'Package plans', responses: { 200: { description: 'Packages' } } },
    },
    '/nursery': {
      get: { tags: ['Nursery'], summary: 'My nursery', responses: { 200: { description: 'Nursery' } } },
    },
    '/nursery/channels': {
      get: { tags: ['Nursery'], summary: 'My sales channels', responses: { 200: { description: 'Channels' } } },
    },
    '/mother-plants': {
      get: { tags: ['Mother plants'], summary: 'List mother plants', responses: { 200: { description: 'List' } } },
      post: { tags: ['Mother plants'], summary: 'Create mother plant', responses: { 201: { description: 'Created' } } },
    },
    '/mother-plants/{id}': {
      get: {
        tags: ['Mother plants'],
        summary: 'Get mother plant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Plant' } },
      },
      patch: {
        tags: ['Mother plants'],
        summary: 'Update mother plant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Mother plants'],
        summary: 'Delete mother plant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/propagation': {
      get: { tags: ['Propagation'], summary: 'List batches', responses: { 200: { description: 'Batches' } } },
      post: { tags: ['Propagation'], summary: 'Create batch', responses: { 201: { description: 'Created' } } },
    },
    '/propagation/{id}': {
      get: {
        tags: ['Propagation'],
        summary: 'Get batch',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Batch' } },
      },
    },
    '/inventory': {
      get: { tags: ['Inventory'], summary: 'List inventory', responses: { 200: { description: 'Stock' } } },
    },
    '/inventory/scan/{code}': {
      get: {
        tags: ['Inventory'],
        summary: 'Scan inventory code',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Item' } },
      },
    },
    '/sales': {
      get: { tags: ['Sales'], summary: 'List sales', responses: { 200: { description: 'Sales' } } },
      post: { tags: ['Sales'], summary: 'Create POS sale', responses: { 201: { description: 'Sale' } } },
    },
    '/vermicompost': {
      get: { tags: ['Vermicompost'], summary: 'List beds', responses: { 200: { description: 'Beds' } } },
      post: { tags: ['Vermicompost'], summary: 'Create bed', responses: { 201: { description: 'Created' } } },
    },
    '/care': {
      get: { tags: ['Care'], summary: 'Care tasks', responses: { 200: { description: 'Tasks' } } },
    },
    '/distribution/bookings': {
      get: { tags: ['Distribution'], summary: 'List bookings', responses: { 200: { description: 'Bookings' } } },
      post: { tags: ['Distribution'], summary: 'Create booking', responses: { 201: { description: 'Created' } } },
    },
    '/distribution/manifests': {
      get: { tags: ['Distribution'], summary: 'List manifests', responses: { 200: { description: 'Manifests' } } },
    },
    '/reports/dashboard': {
      get: { tags: ['Reports'], summary: 'Dashboard stats', responses: { 200: { description: 'Stats' } } },
    },
    '/reports/profitability': {
      get: { tags: ['Reports'], summary: 'Profitability', responses: { 200: { description: 'Report' } } },
    },
    '/expenses': {
      get: { tags: ['Expenses'], summary: 'List expenses', responses: { 200: { description: 'Expenses' } } },
      post: { tags: ['Expenses'], summary: 'Create expense', responses: { 201: { description: 'Created' } } },
    },
    '/audit': {
      get: { tags: ['Audit'], summary: 'Audit log', responses: { 200: { description: 'Rows' } } },
    },
    '/smart/alerts': {
      get: {
        tags: ['Smart / Alerts'],
        summary: 'List danger alerts',
        parameters: [
          { name: 'nurseryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'placeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Alerts + filters' } },
      },
      post: { tags: ['Smart / Alerts'], summary: 'Raise alert (multipart photo)', responses: { 201: { description: 'Created' } } },
    },
    '/smart/alerts/{id}': {
      patch: {
        tags: ['Smart / Alerts'],
        summary: 'Update / close alert',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/smart/zones': {
      get: { tags: ['Smart / Alerts'], summary: 'Camera zones', responses: { 200: { description: 'Zones' } } },
      post: { tags: ['Smart / Alerts'], summary: 'Create zone', responses: { 201: { description: 'Created' } } },
    },
    '/smart/treatments': {
      get: { tags: ['Smart / Alerts'], summary: 'Treatments', responses: { 200: { description: 'List' } } },
      post: { tags: ['Smart / Alerts'], summary: 'Create treatment', responses: { 201: { description: 'Created' } } },
    },
    '/smart/voice': {
      post: { tags: ['Smart / Alerts'], summary: 'Voice desk query', responses: { 200: { description: 'Answer' } } },
    },
    '/live/board': {
      get: { tags: ['Live camera'], summary: 'Live board', responses: { 200: { description: 'Sites + cameras' } } },
    },
    '/live/intrusions': {
      get: { tags: ['Live camera'], summary: 'Recent intrusion events', responses: { 200: { description: 'Events' } } },
    },
    '/live/cameras': {
      post: { tags: ['Live camera'], summary: 'Register camera', responses: { 201: { description: 'Camera' } } },
    },
    '/live/cameras/{id}/case': {
      post: {
        tags: ['Live camera'],
        summary: 'Upload intrusion case (photo/video)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Danger alert created' } },
      },
    },
    '/live/cameras/{id}/frame': {
      get: {
        tags: ['Live camera'],
        summary: 'Latest live JPEG frame',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'image/jpeg' }, 204: { description: 'No fresh frame' } },
      },
      post: {
        tags: ['Live camera'],
        summary: 'Publish live frame',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 204: { description: 'Saved' } },
      },
    },
  },
} as const;
