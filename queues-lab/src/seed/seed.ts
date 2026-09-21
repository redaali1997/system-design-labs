import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { Order } from '../orders/order.entity';

const TOTAL_ORDERS = 50;

async function seed() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [Order],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Connected. Clearing existing orders...');
  await dataSource.getRepository(Order).clear();

  console.log(`Seeding ${TOTAL_ORDERS} pending orders...`);
  const orders = Array.from({ length: TOTAL_ORDERS }, () => ({
    customerId: faker.string.uuid(),
    status: 'pending' as const,
    amount: Number(faker.commerce.price({ min: 5, max: 2000 })),
  }));

  await dataSource
    .createQueryBuilder()
    .insert()
    .into(Order)
    .values(orders)
    .execute();

  console.log(`Done. Seeded ${TOTAL_ORDERS} orders.`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
