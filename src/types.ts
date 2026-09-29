export type EstadoPedido = 'recibido' | 'aceptado' | 'rechazado' | 'preparando' | 'comanda_lista' | 'en_camino' | 'entregado';
export type MetodoPago = 'efectivo' | 'transferencia' | 'gpay';
export type TipoPedido = 'delivery' | 'salon' | 'retiro';

export interface Cliente {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  celular: string;
  email: string;
  password?: string;
  fechaRegistro?: string;
  bloqueado?: boolean;
  motivoBloqueo?: string;
  online?: boolean;
  ultimaConexion?: string;
}

export interface Pedido {
  id: string;
  cliente: string;
  clienteEmail?: string;
  clienteCedula?: string;
  telefono: string;
  direccion: string;
  direccionCliente?: string;
  fecha?: string;
  latitudCliente: number;
  longitudCliente: number;
  restauranteNombre: string;
  latitudRestaurante: number;
  longitudRestaurante: number;
  repartidorId: string;
  repartidorNombre: string;
  estado: EstadoPedido;
  notaCliente: string;
  instruccionOptimizada?: string;
  detallesPedido?: string;
  items: string[];
  total: number;
  metodoPago?: MetodoPago;
  montoPagaCon?: number;
  comprobanteUrl?: string;
  comprobanteNombre?: string;
  comprobanteRevisado?: boolean;
  latitudActual?: number;
  longitudActual?: number;
  ultimaActualizacion?: string;
  tipoPedido?: TipoPedido;
  mesaNumero?: number;
  mozoNombre?: string;
}

export type EstadoMesa = 'libre' | 'ocupada' | 'cuenta_pedida';

export interface ItemComandaMesa {
  id: string;
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  observacion?: string;
  agregadoEn?: string;
}

export interface Mesa {
  numero: number; // 1 a 15
  nombre: string; // "Mesa 1", etc.
  estado: EstadoMesa; // 'libre' | 'ocupada' | 'cuenta_pedida'
  capacidad: number; // ej. 2, 4, 6 personas
  mozoAsignado?: string; // nombre del mozo
  clienteNombre?: string; // nombre opcional
  items: ItemComandaMesa[];
  total: number;
  aperturaHora?: string;
  ultimaComandaHora?: string;
  nota?: string;
  metodoPagoCobro?: MetodoPago;
  pedidoId?: string; // ID del pedido en cocina
}

export interface Repartidor {
  id: string;
  nombre: string;
  vehiculo: 'moto' | 'bicicleta' | 'auto';
  telefono: string;
  chapa?: string;
  latitud: number;
  longitud: number;
  disponible: boolean;
  activo?: boolean;
  bateria?: number;
  usuario?: string;
  password?: string;
}

export interface GPSUpdate {
  repartidorId: string;
  pedidoId: string;
  latitud: number;
  longitud: number;
  timestamp: string;
}

export interface Producto {
  id: string;
  nombre: string;
  cantidad: number; // Stock / disponible
  monto: number;    // Precio en Gs.
  fotoUrl: string;  // URL o base64
  imagen?: string;  // Alias for fotoUrl
  categoria?: string;
  descripcion?: string;
}

export interface CartItem {
  producto: Producto;
  cantidad: number;
  observacion?: string;
}

export interface RestauranteConfig {
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono?: string;
  logoUrl?: string;
}

export type ViewRole = 'cliente' | 'repartidor' | 'admin' | 'cocina' | 'mozo';

export interface CierreDetallePedido {
  id: string;
  fecha: string;
  cliente: string;
  repartidorId?: string;
  repartidorNombre: string;
  items: string[];
  total: number;
  estado?: string;
  telefono?: string;
  direccion?: string;
}

export interface CierreDeCaja {
  id: string;
  fechaCierre: string; // ISO String
  fechaInicio: string; // ISO String
  montoInicial: number;
  totalVentas: number;
  cantidadPedidos: number;
  observaciones?: string;
  usuarioCierre: string;
  pedidos: CierreDetallePedido[];
}
