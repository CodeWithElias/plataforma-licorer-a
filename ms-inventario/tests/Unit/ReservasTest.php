<?php

namespace Tests\Unit;

use Inventario\Entities\EstadoReserva;
use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Excepciones\ProductoNoEncontrado;
use Inventario\Entities\Excepciones\ReservaConfirmada;
use Inventario\Entities\Excepciones\ReservaLiberada;
use Inventario\Entities\Excepciones\ReservaNoEncontrada;
use Inventario\Entities\Excepciones\SinStock;
use Inventario\Entities\ItemReserva;
use Inventario\UseCases\ConfirmarReserva;
use Inventario\UseCases\LiberarStock;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\ReservarStock;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Dobles\NotificadorEspia;
use Tests\Unit\Dobles\ReservasEnMemoria;
use Tests\Unit\Dobles\StockEnMemoria;

class ReservasTest extends TestCase
{
    private const ID = '0b9e6c1a-4f2d-4c8e-9a31-2d7f5b8e1c04';

    private StockEnMemoria $stock;

    private ReservasEnMemoria $reservas;

    private NotificadorEspia $notificador;

    protected function setUp(): void
    {
        $this->stock = new StockEnMemoria;
        $this->stock->poner('CER-001', cantidad: 48, minimo: 12);
        $this->stock->poner('VIN-001', cantidad: 5, minimo: 2);
        $this->reservas = new ReservasEnMemoria($this->stock);
        $this->notificador = new NotificadorEspia;
    }

    private function reservar(array $items, string $id = self::ID)
    {
        return (new ReservarStock($this->reservas, $this->stock))->ejecutar($id, $items);
    }

    private function confirmar(string $id = self::ID)
    {
        return (new ConfirmarReserva($this->reservas, $this->stock, $this->notificador))->ejecutar($id);
    }

    private function liberar(string $id = self::ID)
    {
        return (new LiberarStock($this->reservas, $this->stock))->ejecutar($id);
    }

    // ---------- ReservarStock ----------

    public function test_reserva_suma_a_reservado_y_queda_activa(): void
    {
        $r = $this->reservar([new ItemReserva('CER-001', 6), new ItemReserva('VIN-001', 2)]);

        $this->assertTrue($r->creada);
        $this->assertSame(EstadoReserva::Activa, $r->reserva->estado);
        $this->assertSame(6, $this->stock->de('CER-001')->reservado);
        $this->assertSame(42, $this->stock->de('CER-001')->disponible());
        $this->assertSame(2, $this->stock->de('VIN-001')->reservado);
    }

    public function test_repetir_la_misma_reserva_no_reserva_dos_veces(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);
        $segunda = $this->reservar([new ItemReserva('CER-001', 6)]);

        $this->assertFalse($segunda->creada);
        $this->assertSame(6, $this->stock->de('CER-001')->reservado);
    }

    public function test_productos_repetidos_se_suman(): void
    {
        $r = $this->reservar([new ItemReserva('CER-001', 2), new ItemReserva('CER-001', 3)]);

        $this->assertCount(1, $r->reserva->items);
        $this->assertSame(5, $this->stock->de('CER-001')->reservado);
    }

    public function test_sin_stock_no_reserva_nada_e_indica_faltantes(): void
    {
        try {
            $this->reservar([new ItemReserva('CER-001', 6), new ItemReserva('VIN-001', 10)]);
            $this->fail('Debía lanzar SinStock');
        } catch (SinStock $e) {
            $this->assertSame([['productoCodigo' => 'VIN-001', 'pedido' => 10, 'disponible' => 5]], $e->faltantes);
        }
        $this->assertSame(0, $this->stock->de('CER-001')->reservado);
        $this->assertSame([], $this->reservas->reservas);
    }

    public function test_lo_reservado_no_esta_disponible_para_otra_venta(): void
    {
        $this->reservar([new ItemReserva('VIN-001', 4)]);

        $this->expectException(SinStock::class);
        $this->reservar([new ItemReserva('VIN-001', 2)], '77aa3b9c-1d2e-4f50-a6b7-c8d9e0f1a2b3');
    }

    public function test_producto_sin_stock_registrado(): void
    {
        $this->expectException(ProductoNoEncontrado::class);
        $this->reservar([new ItemReserva('XXX-999', 1)]);
    }

    public function test_reserva_id_debe_ser_uuid(): void
    {
        $this->expectException(DatosInvalidos::class);
        $this->reservar([new ItemReserva('CER-001', 1)], 'no-es-uuid');
    }

    public function test_cantidad_debe_ser_positiva(): void
    {
        $this->expectException(DatosInvalidos::class);
        new ItemReserva('CER-001', 0);
    }

    public function test_bloqueo_optimista_reintenta_si_el_stock_cambio(): void
    {
        $this->reservas->conflictosSimulados = 2;

        $r = $this->reservar([new ItemReserva('CER-001', 6)]);

        $this->assertTrue($r->creada);
        $this->assertSame(6, $this->stock->de('CER-001')->reservado);
    }

    public function test_bloqueo_optimista_se_rinde_tras_tres_intentos(): void
    {
        $this->reservas->conflictosSimulados = ReservarStock::MAX_INTENTOS;

        $this->expectException(ConflictoConcurrencia::class);
        $this->reservar([new ItemReserva('CER-001', 6)]);
    }

    // ---------- ConfirmarReserva ----------

    public function test_confirmar_descuenta_cantidad_y_reservado(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);

        $this->assertSame(EstadoReserva::Confirmada, $this->confirmar()->estado);
        $this->assertSame(42, $this->stock->de('CER-001')->cantidad);
        $this->assertSame(0, $this->stock->de('CER-001')->reservado);
    }

    public function test_confirmar_dos_veces_descuenta_una_sola_vez(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);
        $this->confirmar();
        $this->confirmar();

        $this->assertSame(42, $this->stock->de('CER-001')->cantidad);
    }

    public function test_no_se_confirma_una_reserva_liberada(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);
        $this->liberar();

        $this->expectException(ReservaLiberada::class);
        $this->confirmar();
    }

    public function test_confirmar_reserva_inexistente(): void
    {
        $this->expectException(ReservaNoEncontrada::class);
        $this->confirmar();
    }

    public function test_avisa_stock_bajo_una_sola_vez(): void
    {
        $this->reservar([new ItemReserva('CER-001', 40)]);
        $this->confirmar();   // queda 8 < 12
        $this->reservar([new ItemReserva('CER-001', 1)], '77aa3b9c-1d2e-4f50-a6b7-c8d9e0f1a2b3');
        $this->confirmar('77aa3b9c-1d2e-4f50-a6b7-c8d9e0f1a2b3');   // queda 7, ya se avisó

        $this->assertSame([['productoCodigo' => 'CER-001', 'cantidad' => 8, 'minimo' => 12]], $this->notificador->avisos);
        $this->assertTrue($this->stock->de('CER-001')->avisoEnviado);
    }

    public function test_no_avisa_si_queda_sobre_el_minimo(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);
        $this->confirmar();   // queda 42

        $this->assertSame([], $this->notificador->avisos);
    }

    // ---------- LiberarStock ----------

    public function test_liberar_devuelve_lo_reservado(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);

        $this->assertSame(EstadoReserva::Liberada, $this->liberar()->estado);
        $this->assertSame(0, $this->stock->de('CER-001')->reservado);
        $this->assertSame(48, $this->stock->de('CER-001')->cantidad);
    }

    public function test_liberar_dos_veces_no_hace_nada_la_segunda(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);
        $this->liberar();
        $this->liberar();

        $this->assertSame(0, $this->stock->de('CER-001')->reservado);
    }

    public function test_no_se_libera_una_reserva_confirmada(): void
    {
        $this->reservar([new ItemReserva('CER-001', 6)]);
        $this->confirmar();

        $this->expectException(ReservaConfirmada::class);
        $this->liberar();
    }
}
