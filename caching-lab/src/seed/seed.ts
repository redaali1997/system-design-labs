import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { Product } from '../products/product.entity';

const TOTAL_PRODUCTS = 50_000;
const BATCH_SIZE = 1_000;

async function seed() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [Product],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Connected. Clearing existing products...');
  await dataSource.getRepository(Product).clear();

  console.log(
    `Seeding ${TOTAL_PRODUCTS} products in batches of ${BATCH_SIZE}...`,
  );
  const start = Date.now();

  for (
    let batchStart = 0;
    batchStart < TOTAL_PRODUCTS;
    batchStart += BATCH_SIZE
  ) {
    const batch = Array.from({ length: BATCH_SIZE }, () => ({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: Number(faker.commerce.price({ min: 1, max: 1000 })),
      stockQuantity: faker.number.int({ min: 0, max: 500 }),
    }));

    await dataSource
      .createQueryBuilder()
      .insert()
      .into(Product)
      .values(batch)
      .execute();

    console.log(`Inserted ${batchStart + BATCH_SIZE}/${TOTAL_PRODUCTS}`);
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done. Seeded ${TOTAL_PRODUCTS} products in ${seconds}s.`);

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
