import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'failed';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customerId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending',
  })
  status: OrderStatus;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;
}
