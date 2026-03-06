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
    dtGeracao!: string;

    @Column({ type: 'text', nullable: true })
    area!: string;

    @Column({ type: 'text', nullable: true })
    servico!: string;

    @Column({ type: 'text', nullable: true })
    equipe!: string;

    @Column({ type: 'text', nullable: true })
    descricao!: string;

    @Column({ type: 'text', nullable: true })
    solicitante!: string;

    @Column({ type: 'text', nullable: true })
    unidade!: string;

    @Column({ type: 'text', nullable: true })
    status!: string;

    @Column({ type: 'text', nullable: true })
    responsavel!: string;

    @Column({ type: 'text', nullable: true })
    dtAtendimento!: string;

    @Column({ type: 'text', nullable: true })
    prioridade!: string;

    @Column({ type: 'text', nullable: true })
    tempoEspera!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
