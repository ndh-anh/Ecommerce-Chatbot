import { EventsRepository } from './events.repository';
import { Module } from '@nestjs/common';
import {
  BaseEventsController,
  EVENTS_CONTROLLER,
} from '@generated-controller/event/events/base-events.controller';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [BaseEventsController],
  providers: [
    EventsService,
    EventsRepository,
    {
      provide: EVENTS_CONTROLLER,
      useClass: EventsController,
    },
  ],
})
export class EventsModule {}
