package com.licoreria.ventas.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase;
import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.Comando;
import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.LineaPedida;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase.Resultado;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase.ResultadoItem;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase.VentaOffline;
import com.licoreria.ventas.application.service.SincronizarVentasService;
import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import com.licoreria.ventas.domain.exception.SinStockException;
import com.licoreria.ventas.domain.model.DetalleVenta;
import com.licoreria.ventas.domain.model.OrigenVenta;
import com.licoreria.ventas.domain.model.Venta;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** CU03 probado con un RegistrarVentaUseCase falso que recuerda los operationId ya vendidos. */
class SincronizarVentasServiceTest {

  private RegistrarFalso registrar;
  private SincronizarVentasService servicio;

  @BeforeEach
  void preparar() {
    registrar = new RegistrarFalso();
    servicio = new SincronizarVentasService(registrar);
  }

  private static VentaOffline venta(String operationId, String codigo) {
    return new VentaOffline(operationId, List.of(new LineaPedida(codigo, 1)), "EFECTIVO", OffsetDateTime.now().minusHours(2));
  }

  @Test
  void ventaNuevaQuedaOkConOrigenOfflineYFechaLocal() {
    VentaOffline v = venta(UUID.randomUUID().toString(), "CER-001");
    List<ResultadoItem> r = servicio.sincronizar("cajero-1", List.of(v), "token");

    assertThat(r).extracting(ResultadoItem::resultado).containsExactly(Resultado.OK);
    assertThat(registrar.comandos.get(0).origen()).isEqualTo(OrigenVenta.OFFLINE);
    assertThat(registrar.comandos.get(0).fechaLocal()).isEqualTo(v.fechaLocal());
  }

  @Test
  void laMismaVentaRepetidaEnElLoteSeRegistraUnaSolaVez() {
    String id = UUID.randomUUID().toString();
    List<ResultadoItem> r = servicio.sincronizar("cajero-1", List.of(venta(id, "CER-001"), venta(id, "CER-001")), "token");

    assertThat(r).extracting(ResultadoItem::resultado).containsExactly(Resultado.OK, Resultado.DUPLICADO);
    assertThat(registrar.comandos).hasSize(1);
  }

  @Test
  void reenviarElLoteDevuelveDuplicadoConLaVentaOriginal() {
    String id = UUID.randomUUID().toString();
    ResultadoItem primero = servicio.sincronizar("cajero-1", List.of(venta(id, "CER-001")), "token").get(0);
    ResultadoItem segundo = servicio.sincronizar("cajero-1", List.of(venta(id, "CER-001")), "token").get(0);

    assertThat(segundo.resultado()).isEqualTo(Resultado.DUPLICADO);
    assertThat(segundo.venta().getId()).isEqualTo(primero.venta().getId());
  }

  @Test
  void unErrorNoDetieneElRestoDelLote() {
    registrar.sinStock.add("WHI-003");
    List<ResultadoItem> r = servicio.sincronizar("cajero-1", List.of(
        venta(UUID.randomUUID().toString(), "WHI-003"),
        venta("no-es-uuid", "CER-001"),
        new VentaOffline(UUID.randomUUID().toString(), List.of(new LineaPedida("CER-001", 1)), "CHEQUE", null),
        venta(UUID.randomUUID().toString(), "CER-001")), "token");

    assertThat(r).extracting(ResultadoItem::resultado)
        .containsExactly(Resultado.ERROR, Resultado.ERROR, Resultado.ERROR, Resultado.OK);
    assertThat(r).extracting(ResultadoItem::motivo)
        .containsExactly("SIN_STOCK", "DATOS_INVALIDOS", "DATOS_INVALIDOS", null);
  }

  @Test
  void loteVacioOMuyGrandeSeRechaza() {
    assertThatThrownBy(() -> servicio.sincronizar("c", List.of(), "t")).isInstanceOf(DatosInvalidosException.class);
    List<VentaOffline> grande = Collections.nCopies(SincronizarVentasService.MAX_LOTE + 1, venta(UUID.randomUUID().toString(), "CER-001"));
    assertThatThrownBy(() -> servicio.sincronizar("c", grande, "t")).isInstanceOf(DatosInvalidosException.class);
  }

  /** Igual que RegistrarVentaService: un operationId ya vendido no se ejecuta otra vez. */
  static class RegistrarFalso implements RegistrarVentaUseCase {
    final List<Comando> comandos = new ArrayList<>();
    final List<String> sinStock = new ArrayList<>();
    private final Map<UUID, Venta> vendidas = new HashMap<>();

    @Override
    public Resultado registrar(Comando c, String token) {
      if (vendidas.containsKey(c.operationId())) {
        return new Resultado(vendidas.get(c.operationId()), false);
      }
      comandos.add(c);
      String codigo = c.items().get(0).productoCodigo();
      if (sinStock.contains(codigo)) {
        throw new SinStockException(List.of());
      }
      Venta v = Venta.nueva(c.operationId(), c.cajeroId(), List.of(new DetalleVenta(codigo, codigo, 1, BigDecimal.TEN)),
          c.metodo(), c.origen(), OffsetDateTime.now());
      vendidas.put(c.operationId(), v);
      return new Resultado(v, true);
    }
  }
}
