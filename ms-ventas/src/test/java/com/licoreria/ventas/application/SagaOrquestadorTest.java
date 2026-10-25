package com.licoreria.ventas.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.licoreria.ventas.application.port.out.GestionPort;
import com.licoreria.ventas.application.port.out.InventarioPort;
import com.licoreria.ventas.application.port.out.SagaRepositoryPort;
import com.licoreria.ventas.application.port.out.VentaRepositoryPort;
import com.licoreria.ventas.application.service.SagaOrquestador;
import com.licoreria.ventas.domain.exception.SagaCompensadaException;
import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import com.licoreria.ventas.domain.exception.SinStockException;
import com.licoreria.ventas.domain.model.DetalleVenta;
import com.licoreria.ventas.domain.model.EstadoVenta;
import com.licoreria.ventas.domain.model.MetodoPago;
import com.licoreria.ventas.domain.model.OrigenVenta;
import com.licoreria.ventas.domain.model.Pago;
import com.licoreria.ventas.domain.model.Venta;
import com.licoreria.ventas.domain.saga.EstadoSaga;
import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Saga probada con puertos falsos: no necesita ms-inventario, ms-gestion ni PostgreSQL. */
class SagaOrquestadorTest {

  private VentasFalsas ventas;
  private SagasFalsas sagas;
  private InventarioFalso inventario;
  private GestionFalsa gestion;
  private SagaOrquestador orquestador;

  @BeforeEach
  void preparar() {
    ventas = new VentasFalsas();
    sagas = new SagasFalsas();
    inventario = new InventarioFalso();
    gestion = new GestionFalsa();
    orquestador = new SagaOrquestador(ventas, sagas, inventario, gestion);
  }

  private static Venta ventaNueva() {
    return Venta.nueva(UUID.randomUUID(), "cajero-1",
        List.of(new DetalleVenta("CER-001", "Paceña", 6, new BigDecimal("12.00")),
                new DetalleVenta("VIN-001", "Kohlberg", 1, new BigDecimal("45.00"))),
        MetodoPago.EFECTIVO, OrigenVenta.ONLINE, OffsetDateTime.now());
  }

  @Test
  void ventaNormalQuedaCompletadaConTotalCalculado() {
    Venta v = orquestador.ejecutar(ventaNueva(), "token");

    assertThat(v.getEstado()).isEqualTo(EstadoVenta.COMPLETADA);
    assertThat(v.total()).isEqualByComparingTo("117.00");
    assertThat(v.getNumero()).isEqualTo(1L);
    assertThat(inventario.llamadas).containsExactly("reservar", "confirmar");
    assertThat(gestion.llamadas).containsExactly("registrar");
    assertThat(sagas.de(v).getEstado()).isEqualTo(EstadoSaga.COMPLETADA);
  }

  @Test
  void sinStockCompensaYLaVentaQuedaCancelada() {
    inventario.sinStock = true;
    Venta v = ventaNueva();

    assertThatThrownBy(() -> orquestador.ejecutar(v, "token")).isInstanceOf(SinStockException.class);

    assertThat(ventas.porId.get(v.getId()).getEstado()).isEqualTo(EstadoVenta.CANCELADA);
    assertThat(ventas.porId.get(v.getId()).getPago().getEstado()).isEqualTo(Pago.Estado.REEMBOLSADO);
    assertThat(gestion.llamadas).isEmpty();                     // nunca se registró ingreso
    assertThat(inventario.llamadas).containsExactly("reservar", "liberar");
    assertThat(sagas.de(v).getEstado()).isEqualTo(EstadoSaga.COMPENSADA);
  }

  @Test
  void siGestionFallaSeLiberaLaReservaEnOrdenInverso() {
    gestion.caido = true;
    Venta v = ventaNueva();

    assertThatThrownBy(() -> orquestador.ejecutar(v, "token")).isInstanceOf(SagaCompensadaException.class);

    assertThat(gestion.llamadas).containsExactly("registrar", "anular");
    assertThat(inventario.llamadas).containsExactly("reservar", "liberar");
    assertThat(ventas.porId.get(v.getId()).getEstado()).isEqualTo(EstadoVenta.CANCELADA);
    assertThat(sagas.de(v).getEstado()).isEqualTo(EstadoSaga.COMPENSADA);
  }

  @Test
  void siLaCompensacionFallaQuedaCompensandoYSeTerminaAlReintentar() {
    gestion.caido = true;
    inventario.liberarCaido = true;
    Venta v = ventaNueva();

    assertThatThrownBy(() -> orquestador.ejecutar(v, "token")).isInstanceOf(SagaCompensadaException.class);
    SagaInstancia saga = sagas.de(v);
    assertThat(saga.getEstado()).isEqualTo(EstadoSaga.COMPENSANDO);
    assertThat(saga.getError()).contains("liberar reserva");
    // Lo que sí se pudo compensar se hizo igual: ingreso anulado y venta cancelada con pago reembolsado
    assertThat(gestion.llamadas).containsExactly("registrar", "anular");
    assertThat(ventas.porId.get(v.getId()).getEstado()).isEqualTo(EstadoVenta.CANCELADA);

    // ms-inventario vuelve: la tarea programada reintenta
    inventario.liberarCaido = false;
    orquestador.compensar(saga, ventas.porId.get(v.getId()), "token-servicio", saga.getError());

    assertThat(sagas.de(v).getEstado()).isEqualTo(EstadoSaga.COMPENSADA);
    assertThat(ventas.porId.get(v.getId()).getEstado()).isEqualTo(EstadoVenta.CANCELADA);
  }

  @Test
  void conGestionCaidoSeLiberaElStockYLaAnulacionQuedaPendiente() {
    gestion.caido = true;
    gestion.anularCaido = true;
    Venta v = ventaNueva();

    assertThatThrownBy(() -> orquestador.ejecutar(v, "token")).isInstanceOf(SagaCompensadaException.class);

    assertThat(inventario.llamadas).containsExactly("reservar", "liberar");   // el stock se libera ya
    assertThat(ventas.porId.get(v.getId()).getEstado()).isEqualTo(EstadoVenta.CANCELADA);
    assertThat(sagas.de(v).getEstado()).isEqualTo(EstadoSaga.COMPENSANDO);  // falta confirmar con ms-gestion

    gestion.anularCaido = false;   // ms-gestion vuelve
    orquestador.compensar(sagas.de(v), ventas.porId.get(v.getId()), "token-servicio", "reintento");
    assertThat(sagas.de(v).getEstado()).isEqualTo(EstadoSaga.COMPENSADA);
  }

  @Test
  void elTokenDelCajeroSeReenviaATodosLosServicios() {
    orquestador.ejecutar(ventaNueva(), "token-del-cajero");

    assertThat(inventario.tokens).containsOnly("token-del-cajero");
    assertThat(gestion.tokens).containsOnly("token-del-cajero");
  }

  // ---------- Puertos falsos ----------

  static class VentasFalsas implements VentaRepositoryPort {
    final Map<UUID, Venta> porId = new HashMap<>();
    long numero = 0;

    public Venta guardar(Venta v) {
      if (!porId.containsKey(v.getId())) {
        v.asignarNumero(++numero);
      }
      porId.put(v.getId(), v);
      return v;
    }
    public Optional<Venta> buscarPorId(UUID id) { return Optional.ofNullable(porId.get(id)); }
    public Optional<Venta> buscarPorOperationId(UUID op) {
      return porId.values().stream().filter(v -> v.getOperationId().equals(op)).findFirst();
    }
    public List<Venta> completadasEntre(OffsetDateTime d, OffsetDateTime h) { return List.of(); }
  }

  static class SagasFalsas implements SagaRepositoryPort {
    final Map<UUID, SagaInstancia> porVenta = new HashMap<>();

    public void guardar(SagaInstancia s) { porVenta.put(s.getVentaId(), s); }
    public Optional<SagaInstancia> buscarPorVenta(UUID id) { return Optional.ofNullable(porVenta.get(id)); }
    public List<SagaInstancia> pendientes(OffsetDateTime limite) { return List.of(); }
    SagaInstancia de(Venta v) { return porVenta.get(v.getId()); }
  }

  static class InventarioFalso implements InventarioPort {
    boolean sinStock;
    boolean liberarCaido;
    final List<String> llamadas = new ArrayList<>();
    final List<String> tokens = new ArrayList<>();

    public ProductoCatalogo obtenerProducto(String codigo, String token) {
      return new ProductoCatalogo(codigo, codigo, BigDecimal.TEN);
    }
    public void reservar(UUID id, List<DetalleVenta> items, String token) {
      llamadas.add("reservar");
      tokens.add(token);
      if (sinStock) {
        throw new SinStockException(List.of(Map.of("productoCodigo", "CER-001", "pedido", 6, "disponible", 2)));
      }
    }
    public void confirmar(UUID id, String token) {
      llamadas.add("confirmar");
      tokens.add(token);
    }
    public void liberar(UUID id, String token) {
      llamadas.add("liberar");
      if (liberarCaido) {
        throw new ServicioRemotoException("ms-inventario no respondió");
      }
    }
  }

  static class GestionFalsa implements GestionPort {
    boolean caido;
    boolean anularCaido;
    final List<String> llamadas = new ArrayList<>();
    final List<String> tokens = new ArrayList<>();

    public String registrarIngreso(Venta venta, String token) {
      llamadas.add("registrar");
      tokens.add(token);
      if (caido) {
        throw new ServicioRemotoException("ms-gestion no respondió");
      }
      return "ingreso-1";
    }
    public void anularIngreso(UUID operationId, String token) {
      llamadas.add("anular");
      if (anularCaido) {
        throw new ServicioRemotoException("ms-gestion no respondió");
      }
    }
  }
}
