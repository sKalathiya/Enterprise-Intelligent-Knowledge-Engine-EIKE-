import { ClassSerializerInterceptor, Controller, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service.js';

@Controller('user')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}
}
