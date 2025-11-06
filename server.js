import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 6767;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/submit', (req, res) => {
  console.log(req.body);
  res.send('Form submitted');
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server limping on port ${PORT}`);
  console.log(`Ctrl + click: ${url}`);
});
