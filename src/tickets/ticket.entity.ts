import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('tickets')
export class Ticket {
    /** VirtualIF internal ID (e.g. "131032") */
    @PrimaryColumn({ type: 'text' })
    id!: string;

    @Column({ type: 'text', nullable: true })
    openedAt!: string;

    @Column({ type: 'text', nullable: true })
    area!: string;

    @Column({ type: 'text', nullable: true })
    service!: string;

    @Column({ type: 'text', nullable: true })
    team!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'text', nullable: true })
    requester!: string;

    @Column({ type: 'text', nullable: true })
    unit!: string;

    @Column({ type: 'text', nullable: true })
    status!: string;

    @Column({ type: 'text', nullable: true })
    assignee!: string;

    @Column({ type: 'text', nullable: true })
    attendedAt!: string;

    @Column({ type: 'text', nullable: true })
    priority!: string;

    @Column({ type: 'text', nullable: true })
    waitTime!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
