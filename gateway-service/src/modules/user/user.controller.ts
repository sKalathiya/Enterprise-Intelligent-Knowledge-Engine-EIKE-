import { ClassSerializerInterceptor, Controller, Delete, Param, Req, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service.js';
import { ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiOperation } from '@nestjs/swagger';

@Controller('user')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Delete('/')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteUser(@Req() req: any) {
    return this.userService.deleteUser(req.user.id as string);
  }
}
