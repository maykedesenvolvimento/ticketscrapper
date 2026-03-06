import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { TicketsModule } from './tickets/tickets.module';
import { Ticket } from './tickets/ticket.entity';
import configuration from './config/configuration';

// Ensure the SQLite data directory exists regardless of entry point (app or tests)
mkdirSync('data', { recursive: true });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'data/tickets.sqlite',
      entities: [Ticket],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    TicketsModule,
  ],
})
export class AppModule { }
