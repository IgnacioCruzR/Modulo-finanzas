import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginDto } from './login.dto';
import { Role } from './roles.enum';
import { SecurityUser } from './user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(SecurityUser)
    private readonly users: Repository<SecurityUser>,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.users.query(`
      CREATE TABLE IF NOT EXISTS finanzas.usuario_seguridad (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(180) NOT NULL UNIQUE,
        password_hash VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    const count = await this.users.count();
    if (count > 0) return;

    await this.users.save([
      this.users.create({
        username: 'admin',
        email: 'admin@finanzas.local',
        passwordHash: await bcrypt.hash('Admin123!', 12),
        role: Role.ADMIN,
        activo: true,
      }),
      this.users.create({
        username: 'cajero',
        email: 'cajero@finanzas.local',
        passwordHash: await bcrypt.hash('Cajero123!', 12),
        role: Role.CAJERO,
        activo: true,
      }),
    ]);
  }

  async login(dto: LoginDto) {
    const username = dto.username.trim();
    const user = await this.users.findOne({
      where: [{ username }, { email: username }],
    });
    if (!user?.activo || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const payload = {
      sub: Number(user.id),
      username: user.username,
      email: user.email,
      role: user.role,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      token_type: 'Bearer',
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }
}
