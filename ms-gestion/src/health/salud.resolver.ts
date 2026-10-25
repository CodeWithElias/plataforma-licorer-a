import { Query, Resolver } from '@nestjs/graphql';
import { Publico } from '../compartido/auth/decoradores.js';

@Resolver()
export class SaludResolver {
  @Publico()
  @Query()
  salud(): string {
    return 'ok';
  }
}
