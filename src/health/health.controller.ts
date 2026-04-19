import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    MongooseHealthIndicator,
    MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        private memory: MemoryHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            // Check MongoDB connectivity
            () => this.mongoose.pingCheck('mongodb'),

            // Check heap memory usage (max 256MB)
            () => this.memory.checkHeap('memory_heap', 256 * 1024 * 1024),
        ]);
    }
}
