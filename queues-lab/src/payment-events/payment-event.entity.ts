import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PaymentEventType = 'paid' | 'refunded' | 'failed';

@Entity()
export class PaymentEvent {
  @PrimaryGeneratedColumn()
  id: number;

  // Deliberately NOT unique — there's no idempotency guard yet. That's the exercise.
  @Column()
  providerEventId: string;

  // Deliberately no FK to Order — no referential/ordering guarantees yet.
  @Column()
  orderId: number;

  @Column({ type: 'enum', enum: ['paid', 'refunded', 'failed'] })
  type: PaymentEventType;

  @CreateDateColumn()
  receivedAt: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  processedAt: Date | null;
}
