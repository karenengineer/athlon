import { createApplication } from "./bootstrap";

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
