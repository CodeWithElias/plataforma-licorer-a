import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class SaludResolver {
  @Query()
  salud(): string {
    return 'ok';
  }
}
