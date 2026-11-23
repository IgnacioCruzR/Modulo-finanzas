import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './roles.enum';

@Entity({ schema: 'finanzas', name: 'usuario_seguridad' })
export class SecurityUser {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: Role;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}
