import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth';
import repositoryRoutes from './routes/repositories';
import changeRoutes from './routes/changes';
import patchsetRoutes from './routes/patchsets';
import commentRoutes from './routes/comments';
import notificationRoutes from './routes/notifications';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/repositories', repositoryRoutes);
app.use('/api/changes', changeRoutes);
app.use('/api/changes', patchsetRoutes);
app.use('/api/changes', commentRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/api/docs`);
});
