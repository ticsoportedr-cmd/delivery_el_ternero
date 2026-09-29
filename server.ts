import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import compression from "compression";
import { Server } from "socket.io";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(compression()); // Activa compresión Gzip/Deflate para acelerar descargas móviles
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 5e7, // 50MB for large custom logos/images
});

// Inicializar cliente de Gemini perezosamente (lazy initialization)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Base de datos en memoria para demo
interface Cliente {
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

const clientes: Cliente[] = [
  {
    id: "CLI-101",
    nombres: "Carlos",
    apellidos: "Benítez",
    cedula: "4521890",
    celular: "+595 981 555001",
    email: "carlos.benitez@gmail.com",
    password: "carlos123",
    fechaRegistro: "2026-06-01T10:00:00.000Z",
    bloqueado: false,
  },
  {
    id: "CLI-102",
    nombres: "María",
    apellidos: "Giménez",
    cedula: "3892104",
    celular: "+595 982 777002",
    email: "maria.gimenez@gmail.com",
    password: "maria123",
    fechaRegistro: "2026-06-10T14:30:00.000Z",
    bloqueado: false,
  },
  {
    id: "CLI-103",
    nombres: "Gustavo",
    apellidos: "Cantero",
    cedula: "5120394",
    celular: "+595 983 999003",
    email: "gustavo.cantero@gmail.com",
    password: "gustavo123",
    fechaRegistro: "2026-06-15T18:20:00.000Z",
    bloqueado: false,
  },
  {
    id: "CLI-104",
    nombres: "Valeria",
    apellidos: "Duarte",
    cedula: "4981203",
    celular: "+595 984 111004",
    email: "valeria.duarte@gmail.com",
    password: "valeria123",
    fechaRegistro: "2026-06-20T19:45:00.000Z",
    bloqueado: false,
  },
  {
    id: "CLI-105",
    nombres: "Rodrigo",
    apellidos: "Insfrán",
    cedula: "3645892",
    celular: "+595 985 222005",
    email: "rodrigo.insfran@gmail.com",
    password: "rodrigo123",
    fechaRegistro: "2026-06-25T20:10:00.000Z",
    bloqueado: false,
  },
];

interface Pedido {
  id: string;
  cliente: string;
  clienteEmail?: string;
  clienteCedula?: string;
  telefono: string;
  direccion: string;
  latitudCliente: number;
  longitudCliente: number;
  restauranteNombre: string;
  latitudRestaurante: number;
  longitudRestaurante: number;
  repartidorId: string;
  repartidorNombre: string;
  estado: "recibido" | "aceptado" | "rechazado" | "preparando" | "comanda_lista" | "en_camino" | "entregado";
  notaCliente: string;
  instruccionOptimizada?: string;
  detallesPedido?: string;
  items: string[];
  total: number;
  metodoPago?: "efectivo" | "transferencia" | "gpay";
  montoPagaCon?: number;
  comprobanteUrl?: string;
  comprobanteNombre?: string;
  comprobanteRevisado?: boolean;
  latitudActual?: number;
  longitudActual?: number;
  ultimaActualizacion?: string;
  tipoPedido?: "delivery" | "salon" | "retiro";
  mesaNumero?: number;
  mozoNombre?: string;
}

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
  numero: number;
  nombre: string;
  estado: "libre" | "ocupada" | "cuenta_pedida";
  capacidad: number;
  mozoAsignado?: string;
  clienteNombre?: string;
  items: ItemComandaMesa[];
  total: number;
  aperturaHora?: string;
  ultimaComandaHora?: string;
  nota?: string;
  metodoPagoCobro?: "efectivo" | "transferencia" | "gpay";
  pedidoId?: string;
}

interface Repartidor {
  id: string;
  nombre: string;
  vehiculo: "moto" | "bicicleta" | "auto";
  telefono: string;
  chapa?: string;
  latitud: number;
  longitud: number;
  disponible: boolean;
  bateria?: number;
  usuario?: string;
  password?: string;
}

interface Producto {
  id: string;
  nombre: string;
  cantidad: number;
  monto: number;
  fotoUrl: string;
  categoria?: string;
  descripcion?: string;
}

interface RestauranteConfig {
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono?: string;
  logoUrl?: string;
}

let restauranteConfig: RestauranteConfig = {
  nombre: "EL TERNERO",
  direccion: "RGG9+R7H, Gral. Elizardo Aquino, Limpio 110816, Paraguay",
  latitud: -25.1747,
  longitud: -57.48334,
  telefono: "+595 981 100200",
  logoUrl: "/el_ternero_logo.svg",
};

// Catálogo de productos iniciales - EL TERNERO
const productos: Producto[] = [
  {
    id: "PROD-PIZZA-01",
    nombre: "Pizza Mozzarella",
    cantidad: 50,
    monto: 35000,
    fotoUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, aceitunas, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-02",
    nombre: "Pizza Margarita",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, tomates, albahaca, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-03",
    nombre: "Pizza Choclo",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, choclo, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-04",
    nombre: "Pizza Napolitana",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, tomates, jamón, aceitunas, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-05",
    nombre: "Pizza Jamón y Queso",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, jamón, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-06",
    nombre: "Pizza Pepperoni",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, pepperoni, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-07",
    nombre: "Pizza Palmito",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, palmito, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-08",
    nombre: "Pizza Vegetariana",
    cantidad: 50,
    monto: 40000,
    fotoUrl: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, cebolla morada, morrones asados, aceitunas, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-09",
    nombre: "Pizza Cuatro Quesos",
    cantidad: 50,
    monto: 45000,
    fotoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, queso catupiry, queso parmesano, queso azul, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-10",
    nombre: "Pizza Pollo Catupiry",
    cantidad: 50,
    monto: 45000,
    fotoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, pollo, queso catupiry, orégano y aceite de oliva."
  },
  {
    id: "PROD-PIZZA-11",
    nombre: "Pizza Carne Catupiry",
    cantidad: 50,
    monto: 45000,
    fotoUrl: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=500&auto=format&fit=crop&q=80",
    categoria: "Pizzas",
    descripcion: "Salsa marinara de la casa, queso mozzarella, carne, queso catupiry, orégano y aceite de oliva."
  },
  {
    id: "PROD-LOMI-01",
    nombre: "Lomipizza Simple",
    cantidad: 30,
    monto: 120000,
    fotoUrl: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=80",
    categoria: "Lomipizzas",
    descripcion: "Especialidad de la casa: Lomipizza rellena con jugoso lomito y abundante queso mozzarella."
  },
  {
    id: "PROD-LOMI-02",
    nombre: "Lomipizza Completa",
    cantidad: 30,
    monto: 150000,
    fotoUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=80",
    categoria: "Lomipizzas",
    descripcion: "Especialidad suprema de la casa: Lomipizza rellena completa con todos los ingredientes especiales."
  },
  {
    id: "PROD-PAPAS-01",
    nombre: "Papas Simples",
    cantidad: 50,
    monto: 15000,
    fotoUrl: "https://images.unsplash.com/photo-1630384060421-cb3f1e576e78?w=600&auto=format&fit=crop&q=80",
    categoria: "Papas Fritas",
    descripcion: "Porción de papas fritas doradas y crujientes."
  },
  {
    id: "PROD-PAPAS-02",
    nombre: "Papas Especiales con Cheddar y Panceta",
    cantidad: 50,
    monto: 20000,
    fotoUrl: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80",
    categoria: "Papas Fritas",
    descripcion: "Papas fritas con abundante queso cheddar fundido, crocante de panceta y cebollita de verdeo."
  },
  {
    id: "PROD-PAPAS-03",
    nombre: "Papas Rancheras",
    cantidad: 50,
    monto: 20000,
    fotoUrl: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80",
    categoria: "Papas Fritas",
    descripcion: "Papas fritas con queso catupiry, panceta y verdeo."
  },
  {
    id: "PROD-PAPAS-04",
    nombre: "Aros de Cebolla Fritos",
    cantidad: 50,
    monto: 20000,
    fotoUrl: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&auto=format&fit=crop&q=80",
    categoria: "Papas Fritas",
    descripcion: "Crujientes aros de cebolla empanados y fritos."
  },
  {
    id: "PROD-BURGER-KIDS",
    nombre: "Burger Kids",
    cantidad: 50,
    monto: 15000,
    fotoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80",
    categoria: "Hamburguesas",
    descripcion: "Pan tostado, mayonesa suave de la casa, un medallón de carne y queso cheddar."
  },
  {
    id: "PROD-BURGER-CLASICA",
    nombre: "Burger Clásica",
    cantidad: 50,
    monto: 20000,
    fotoUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
    categoria: "Hamburguesas",
    descripcion: "Pan tostado, mayonesa suave de la casa, lechuga repollada, tomate, un medallón de carne, huevo frito y queso mozzarella."
  },
  {
    id: "PROD-BURGER-AMERICAN",
    nombre: "American Burger",
    cantidad: 50,
    monto: 25000,
    fotoUrl: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&auto=format&fit=crop&q=80",
    categoria: "Hamburguesas",
    descripcion: "Pan tostado, mayonesa suave de la casa, lechuga repollada, tomate, aros de cebolla morada, un medallón de carne, queso cheddar, panceta y pepinillos."
  },
  {
    id: "PROD-BURGER-CHEESE",
    nombre: "Cheeseburger",
    cantidad: 50,
    monto: 25000,
    fotoUrl: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=600&auto=format&fit=crop&q=80",
    categoria: "Hamburguesas",
    descripcion: "Pan brioche tostado, mayonesa suave de la casa, dos medallones de carne, queso mozzarella y queso cheddar."
  },
  {
    id: "PROD-BURGER-ONION",
    nombre: "Onion Burger",
    cantidad: 50,
    monto: 25000,
    fotoUrl: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f6?w=600&auto=format&fit=crop&q=80",
    categoria: "Hamburguesas",
    descripcion: "Pan tostado, mayonesa suave de la casa, lechuga repollada, tomate, aros de cebolla morada, un medallón de carne, queso cheddar, cebolla caramelizada, aro de cebolla frita y salsa BBQ."
  },
  {
    id: "PROD-BURGER-ITALIAN",
    nombre: "Italian Burger",
    cantidad: 50,
    monto: 30000,
    fotoUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80",
    categoria: "Hamburguesas",
    descripcion: "Pan brioche tostado, mayonesa suave de la casa, dos medallones de carne, queso mozzarella, salsa marinara y pepperoni."
  },
  {
    id: "PROD-103",
    nombre: "Papas Fritas Rústicas Grandes",
    cantidad: 40,
    monto: 18000,
    fotoUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop&q=80",
    categoria: "Acompañamientos",
    descripcion: "Corte grueso con cáscara, condimentadas con romero y sal marina."
  },
  {
    id: "PROD-104",
    nombre: "Gaseosa Coca-Cola 1.5L",
    cantidad: 50,
    monto: 12000,
    fotoUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80",
    categoria: "Bebidas",
    descripcion: "Bebida refrescante bien fría."
  }
];

// Datos iniciales
const repartidores: Repartidor[] = [
  {
    id: "REP-123",
    nombre: "Juan Pérez",
    vehiculo: "moto",
    telefono: "+595 981 112233",
    chapa: "123 ABC Py",
    latitud: -25.1740,
    longitud: -57.4830,
    disponible: true,
    bateria: 88,
    usuario: "juan",
    password: "juan123",
  },
  {
    id: "REP-456",
    nombre: "María González",
    vehiculo: "bicicleta",
    telefono: "+595 982 445566",
    chapa: "BIC-001 Py",
    latitud: -25.1755,
    longitud: -57.4820,
    disponible: true,
    bateria: 95,
    usuario: "maria",
    password: "maria123",
  },
  {
    id: "REP-789",
    nombre: "Carlos Benítez",
    vehiculo: "auto",
    telefono: "+595 983 778899",
    chapa: "XYZ 789 Py",
    latitud: -25.1720,
    longitud: -57.4840,
    disponible: false,
    bateria: 62,
    usuario: "carlos",
    password: "carlos123",
  },
];

const pedidos: Pedido[] = [];

interface CierreDetallePedido {
  id: string;
  fecha: string;
  cliente: string;
  repartidorId?: string;
  repartidorNombre: string;
  items: string[];
  total: number;
}

interface CierreDeCaja {
  id: string;
  fechaCierre: string;
  fechaInicio: string;
  montoInicial: number;
  totalVentas: number;
  cantidadPedidos: number;
  observaciones?: string;
  usuarioCierre: string;
  pedidos: CierreDetallePedido[];
}

const cierresDeCaja: CierreDeCaja[] = [
  {
    id: "CIERRE-2026-07-30-01",
    fechaInicio: "2026-07-30T08:00:00.000Z",
    fechaCierre: "2026-07-30T23:45:00.000Z",
    montoInicial: 200000,
    totalVentas: 485000,
    cantidadPedidos: 6,
    observaciones: "Cierre de caja del día 30 de Julio. Sin descuadres.",
    usuarioCierre: "Administrador",
    pedidos: [
      {
        id: "PED-101",
        fecha: "2026-07-30T12:30:00.000Z",
        cliente: "Marcelo Gómez",
        repartidorNombre: "Juan Pérez",
        items: ["2x Burger Doble Queso", "1x Coca-Cola Zero"],
        total: 85000,
      },
      {
        id: "PED-102",
        fecha: "2026-07-30T14:15:00.000Z",
        cliente: "Lorena Benítez",
        repartidorNombre: "María González",
        items: ["1x Pizza Familiar 4 Quesos", "1x Fanta Naranja 1.5L"],
        total: 95000,
      },
      {
        id: "PED-103",
        fecha: "2026-07-30T19:20:00.000Z",
        cliente: "Carlos Villalba",
        repartidorNombre: "Carlos Rodríguez",
        items: ["1x Lomipizza Catupiry", "2x Cerveza Heineken 600ml"],
        total: 110000,
      },
      {
        id: "PED-104",
        fecha: "2026-07-30T20:45:00.000Z",
        cliente: "Andrea Rojas",
        repartidorNombre: "Juan Pérez",
        items: ["1x Papas Supremas Cheddar", "1x Sprite 1.5L"],
        total: 65000,
      },
      {
        id: "PED-105",
        fecha: "2026-07-30T21:30:00.000Z",
        cliente: "Fernando Vera",
        repartidorNombre: "María González",
        items: ["2x Lomito Completo de Carne", "1x Papas Grandes"],
        total: 80000,
      },
      {
        id: "PED-106",
        fecha: "2026-07-30T22:50:00.000Z",
        cliente: "Patricia Solís",
        repartidorNombre: "Carlos Rodríguez",
        items: ["1x Volcán de Chocolate con Helado"],
        total: 50000,
      },
    ],
  },
  {
    id: "CIERRE-2026-06-30-01",
    fechaInicio: "2026-06-30T08:00:00.000Z",
    fechaCierre: "2026-06-30T23:59:00.000Z",
    montoInicial: 150000,
    totalVentas: 620000,
    cantidadPedidos: 8,
    observaciones: "Cierre mensual de Junio 2026.",
    usuarioCierre: "Administrador",
    pedidos: [
      {
        id: "PED-080",
        fecha: "2026-06-30T13:00:00.000Z",
        cliente: "Gustavo Cantero",
        repartidorNombre: "Juan Pérez",
        items: ["3x Pizza Pepperoni Mediana", "2x Coca-Cola 1.5L"],
        total: 195000,
      },
      {
        id: "PED-081",
        fecha: "2026-06-30T20:10:00.000Z",
        cliente: "Valeria Duarte",
        repartidorNombre: "María González",
        items: ["2x Burger Bacon Triple", "1x Papas Rústicas"],
        total: 125000,
      },
      {
        id: "PED-082",
        fecha: "2026-06-30T21:40:00.000Z",
        cliente: "Rodrigo Insfrán",
        repartidorNombre: "Carlos Rodríguez",
        items: ["2x Lomipizza Especial El Ternero"],
        total: 300000,
      },
    ],
  },
];

// --- NOTIFICACIONES PUSH NATIVAS Y SERVICE WORKER ---
interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  clienteEmail?: string;
  fechaRegistro: string;
}

const pushSubscriptions: PushSubscriptionRecord[] = [];

// Plantillas de Notificaciones Configurables por el Administrador
export interface NotificationTemplates {
  recibido: { title: string; body: string };
  aceptado: { title: string; body: string };
  preparando: { title: string; body: string };
  comanda_lista?: { title: string; body: string };
  en_camino: { title: string; body: string };
  entregado: { title: string; body: string };
  rechazado: { title: string; body: string };
}

let notificationTemplates: NotificationTemplates = {
  recibido: {
    title: "🛵 Nuevo Pedido Recibido",
    body: "¡El pedido #{id} por ₲{total} fue registrado en EL TERNERO!",
  },
  aceptado: {
    title: "✅ Pedido Aceptado",
    body: "¡Tu pedido #{id} fue confirmado y aceptado por EL TERNERO!",
  },
  preparando: {
    title: "👨‍🍳 Pedido en Preparación",
    body: "¡Tu pedido #{id} se está preparando en la cocina de EL TERNERO!",
  },
  en_camino: {
    title: "🛵 Pedido en Camino",
    body: "¡El repartidor {repartidor} va en camino a tu dirección con tu pedido #{id}!",
  },
  entregado: {
    title: "🎉 Pedido Entregado",
    body: "¡Tu pedido #{id} fue entregado con éxito! Que lo disfrutes. ¡Gracias por elegir EL TERNERO!",
  },
  rechazado: {
    title: "⚠️ Pedido Cancelado",
    body: "El pedido #{id} ha sido cancelado o rechazado por el local.",
  },
};

// Categorías portadas y estado
const categoriasPortadas: Record<string, string> = {
  Hamburguesas: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  Pizzas: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
  Lomipizzas: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80',
  'Papas Fritas': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
  Acompañamientos: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&auto=format&fit=crop&q=80',
  Bebidas: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
  Postres: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
};

const categoriasEstado: Record<string, boolean> = {
  Hamburguesas: true,
  Pizzas: true,
  Lomipizzas: true,
  'Papas Fritas': true,
  Acompañamientos: true,
  Bebidas: true,
  Postres: true,
};

// --- MÓDULO DE MOZO / 15 MESAS SALÓN ---
const defaultMesas: Mesa[] = Array.from({ length: 15 }, (_, i) => ({
  numero: i + 1,
  nombre: `Mesa ${i + 1}`,
  estado: 'libre' as const,
  capacidad: i < 4 ? 2 : i < 11 ? 4 : 6,
  items: [],
  total: 0,
}));

let mesas: Mesa[] = defaultMesas.map((m) => ({ ...m, items: [] }));

// --- PERSISTENCIA EN DISCO (SINCRONIZACIÓN MÓVIL Y WEB) ---
// Los datos en vivo se guardan FUERA del código (carpeta data/, excluida de Git y de la vigilancia de Vite).
const DB_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(process.cwd(), "data", "data_store.json");
const SEED_FILE = path.join(process.cwd(), "data_store.seed.json");
try {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE) && fs.existsSync(SEED_FILE)) {
    fs.copyFileSync(SEED_FILE, DB_FILE);
    console.log("🌱 Datos iniciales copiados desde data_store.seed.json");
  }
} catch (err) {
  console.error("No se pudo preparar la carpeta de datos:", err);
}

function saveDatabaseToDisk() {
  try {
    const dataToSave = {
      clientes,
      pedidos,
      repartidores,
      productos,
      restauranteConfig,
      categoriasPortadas,
      categoriasEstado,
      cierresDeCaja,
      notificationTemplates,
      pushSubscriptions,
      mesas,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al guardar base de datos en disco:", err);
  }
}

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.clientes) && parsed.clientes.length > 0) {
          clientes.length = 0;
          clientes.push(...parsed.clientes);
        }
        if (Array.isArray(parsed.pedidos)) {
          pedidos.length = 0;
          pedidos.push(...parsed.pedidos);
        }
        if (Array.isArray(parsed.repartidores) && parsed.repartidores.length > 0) {
          repartidores.length = 0;
          repartidores.push(...parsed.repartidores);
        }
        if (Array.isArray(parsed.productos) && parsed.productos.length > 0) {
          productos.length = 0;
          productos.push(...parsed.productos);
        }
        if (parsed.restauranteConfig && typeof parsed.restauranteConfig === "object") {
          Object.assign(restauranteConfig, parsed.restauranteConfig);
        }
        if (parsed.categoriasPortadas && typeof parsed.categoriasPortadas === "object") {
          Object.keys(categoriasPortadas).forEach((k) => delete categoriasPortadas[k]);
          Object.assign(categoriasPortadas, parsed.categoriasPortadas);
        }
        if (parsed.categoriasEstado && typeof parsed.categoriasEstado === "object") {
          Object.keys(categoriasEstado).forEach((k) => delete categoriasEstado[k]);
          Object.assign(categoriasEstado, parsed.categoriasEstado);
        }
        if (Array.isArray(parsed.cierresDeCaja)) {
          cierresDeCaja.length = 0;
          cierresDeCaja.push(...parsed.cierresDeCaja);
        }
        if (parsed.notificationTemplates && typeof parsed.notificationTemplates === "object") {
          Object.assign(notificationTemplates, parsed.notificationTemplates);
        }
        if (Array.isArray(parsed.pushSubscriptions)) {
          pushSubscriptions.length = 0;
          pushSubscriptions.push(...parsed.pushSubscriptions);
        }
        if (Array.isArray(parsed.mesas) && parsed.mesas.length > 0) {
          mesas.length = 0;
          // Garantizar 15 mesas
          for (let i = 1; i <= 15; i++) {
            const found = parsed.mesas.find((m: Mesa) => m.numero === i);
            if (found) {
              mesas.push(found);
            } else {
              mesas.push({
                numero: i,
                nombre: `Mesa ${i}`,
                estado: 'libre',
                capacidad: i < 4 ? 2 : i < 11 ? 4 : 6,
                items: [],
                total: 0,
              });
            }
          }
        }
        console.log("💾 [PERSISTENCIA OK] Base de datos sincronizada desde data_store.json");
      }
    } else {
      saveDatabaseToDisk();
      console.log("💾 [PERSISTENCIA OK] data_store.json creado e inicializado con datos base.");
    }
  } catch (err) {
    console.error("Error al cargar base de datos desde disco:", err);
  }
}

loadDatabaseFromDisk();

function formatTemplateText(templateText: string, pedido: Pedido): string {
  if (!templateText) return "";
  return templateText
    .replace(/\{id\}/g, pedido.id || "")
    .replace(/\{total\}/g, (pedido.total || 0).toLocaleString("es-PY"))
    .replace(/\{repartidor\}/g, pedido.repartidorNombre || "de EL TERNERO")
    .replace(/\{cliente\}/g, pedido.cliente || "Cliente")
    .replace(/\{restaurante\}/g, pedido.restauranteNombre || restauranteConfig.nombre);
}

function notificarCambioEstadoPedido(pedido: Pedido) {
  // Quedar en preparación sin notificar al cliente hasta que el repartidor cambie a 'en_camino'
  if (pedido.estado === "comanda_lista") {
    return;
  }

  const estado = pedido.estado as keyof NotificationTemplates;
  const tmpl = notificationTemplates[estado] || {
    title: "EL TERNERO Delivery",
    body: `El pedido #${pedido.id} ha cambiado a ${pedido.estado}`,
  };

  const title = formatTemplateText(tmpl.title, pedido);
  const body = formatTemplateText(tmpl.body, pedido);

  const payload = {
    title,
    body,
    icon: "/scooter.svg",
    badge: "/scooter.svg",
    tag: `pedido-${pedido.id}`,
    url: "/",
    pedidoId: pedido.id,
    timestamp: Date.now(),
  };

  io.emit("notificacion_push_nativa", payload);
}

// --- 1. RASTREO GPS EN TIEMPO REAL (Socket.io) ---
io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  // Enviar estado inicial al conectarse
  socket.emit("estado_inicial", {
    pedidos,
    repartidores,
    productos,
    categoriasPortadas,
    categoriasEstado,
    restauranteConfig,
    cierresDeCaja,
    clientes,
    notificationTemplates,
    mesas,
  });

  socket.on("actualizar_config_restaurante", (data: Partial<RestauranteConfig>) => {
    if (data) {
      if (data.nombre) restauranteConfig.nombre = data.nombre;
      if (data.direccion) restauranteConfig.direccion = data.direccion;
      if (data.latitud !== undefined) restauranteConfig.latitud = data.latitud;
      if (data.longitud !== undefined) restauranteConfig.longitud = data.longitud;
      if (data.telefono) restauranteConfig.telefono = data.telefono;
      if (data.logoUrl !== undefined) restauranteConfig.logoUrl = data.logoUrl;

      // Actualizar pedidos existentes con la nueva ubicación del restaurante
      pedidos.forEach((p) => {
        p.restauranteNombre = restauranteConfig.nombre;
        p.latitudRestaurante = restauranteConfig.latitud;
        p.longitudRestaurante = restauranteConfig.longitud;
      });

      io.emit("config_restaurante_actualizada", restauranteConfig);
      io.emit("logo_actualizado", { logoUrl: restauranteConfig.logoUrl });
      io.emit("pedidos_actualizados", pedidos);
      saveDatabaseToDisk();
    }
  });

  // El repartidor transmite su posición GPS
  socket.on("actualizar_ubicacion", (data: {
    repartidorId: string;
    pedidoId: string;
    latitud: number;
    longitud: number;
  }) => {
    console.log(`GPS Repartidor ${data.repartidorId}:`, data.latitud, data.longitud);

    const now = new Date().toISOString();

    // Actualizar estado del pedido en memoria
    const pedido = pedidos.find((p) => p.id === data.pedidoId);
    if (pedido) {
      pedido.latitudActual = data.latitud;
      pedido.longitudActual = data.longitud;
      pedido.ultimaActualizacion = now;
      if (pedido.estado === "preparando" || pedido.estado === "recibido") {
        pedido.estado = "en_camino";
      }
    }

    // Actualizar ubicación del repartidor
    const repartidor = repartidores.find((r) => r.id === data.repartidorId);
    if (repartidor) {
      repartidor.latitud = data.latitud;
      repartidor.longitud = data.longitud;
    }

    const updatePayload = {
      repartidorId: data.repartidorId,
      pedidoId: data.pedidoId,
      latitud: data.latitud,
      longitud: data.longitud,
      timestamp: now,
    };

    // Emitir coordenadas al canal específico del pedido
    io.emit(`tracking_pedido_${data.pedidoId}`, updatePayload);

    // Emitir también globalmente para la vista del mapa general y admin
    io.emit("actualizacion_gps_global", updatePayload);
    saveDatabaseToDisk();
  });

  socket.on("cambiar_estado_pedido", (data: { pedidoId: string; estado: Pedido["estado"] }) => {
    const pedido = pedidos.find((p) => p.id === data.pedidoId);
    if (pedido) {
      pedido.estado = data.estado;
      io.emit("pedido_actualizado", pedido);
      io.emit("pedidos_actualizados", pedidos);
      notificarCambioEstadoPedido(pedido);
      saveDatabaseToDisk();
    }
  });

  // El administrador actualiza el detalle del pedido o lo acepta/rechaza
  socket.on("actualizar_pedido_admin", (data: {
    pedidoId: string;
    estado?: Pedido["estado"];
    detallesPedido?: string;
    repartidorId?: string;
    repartidorNombre?: string;
    comprobanteRevisado?: boolean;
  }) => {
    const pedido = pedidos.find((p) => p.id === data.pedidoId);
    if (pedido) {
      if (data.estado) pedido.estado = data.estado;
      if (data.detallesPedido !== undefined) {
        pedido.detallesPedido = data.detallesPedido;
        pedido.instruccionOptimizada = data.detallesPedido;
      }
      if (data.repartidorId) {
        pedido.repartidorId = data.repartidorId;
        const rep = repartidores.find((r) => r.id === data.repartidorId);
        if (rep) pedido.repartidorNombre = rep.nombre;
      }
      if (data.comprobanteRevisado !== undefined) {
        pedido.comprobanteRevisado = data.comprobanteRevisado;
      }
      io.emit("pedido_actualizado", pedido);
      io.emit("pedidos_actualizados", pedidos);
      notificarCambioEstadoPedido(pedido);
      saveDatabaseToDisk();
    }
  });

  socket.on("eliminar_pedido", (pedidoId: string) => {
    const index = pedidos.findIndex((p) => p.id === pedidoId);
    if (index !== -1) {
      pedidos.splice(index, 1);
      io.emit("pedido_eliminado", pedidoId);
      io.emit("pedidos_actualizados", pedidos);
      saveDatabaseToDisk();
    }
  });

  socket.on("eliminar_repartidor", (driverId: string) => {
    const index = repartidores.findIndex((r) => r.id === driverId);
    if (index !== -1) {
      repartidores.splice(index, 1);
      io.emit("repartidor_eliminado", driverId);
      io.emit("repartidores_actualizados", repartidores);
      saveDatabaseToDisk();
    }
  });

  socket.on("cliente_online", (data: { clienteId?: string; email?: string }) => {
    if (!data) return;
    const target = clientes.find((c) =>
      (data.clienteId && c.id === data.clienteId) ||
      (data.email && c.email && c.email.toLowerCase() === data.email.toLowerCase())
    );
    if (target) {
      socket.data.clienteId = target.id;
      const changed = !target.online;
      target.online = true;
      target.ultimaConexion = new Date().toISOString();
      if (changed) {
        io.emit("clientes_actualizados", clientes);
      }
    }
  });

  socket.on("cliente_offline", (data: { clienteId?: string }) => {
    if (!data || !data.clienteId) return;
    const target = clientes.find((c) => c.id === data.clienteId);
    if (target) {
      target.online = false;
      io.emit("clientes_actualizados", clientes);
    }
  });

  // --- EVENTOS DE MESAS Y MOZOS ---
  socket.on("obtener_mesas", () => {
    socket.emit("mesas_actualizadas", mesas);
  });

  socket.on("actualizar_mesa", (data: Partial<Mesa> & { numero: number }) => {
    const mesa = mesas.find((m) => m.numero === data.numero);
    if (mesa) {
      if (data.estado !== undefined) mesa.estado = data.estado;
      if (data.mozoAsignado !== undefined) mesa.mozoAsignado = data.mozoAsignado;
      if (data.clienteNombre !== undefined) mesa.clienteNombre = data.clienteNombre;
      if (data.nota !== undefined) mesa.nota = data.nota;
      if (data.capacidad !== undefined) mesa.capacidad = data.capacidad;
      if (data.items !== undefined) {
        mesa.items = data.items;
        mesa.total = data.items.reduce((sum, it) => sum + (it.subtotal || 0), 0);
      }
      if (mesa.estado === "ocupada" && !mesa.aperturaHora) {
        mesa.aperturaHora = new Date().toISOString();
      }
      if (mesa.estado === "libre") {
        mesa.items = [];
        mesa.total = 0;
        mesa.clienteNombre = "";
        mesa.nota = "";
        mesa.aperturaHora = undefined;
        mesa.ultimaComandaHora = undefined;
        mesa.pedidoId = undefined;
      }
      io.emit("mesas_actualizadas", mesas);
      saveDatabaseToDisk();
    }
  });

  socket.on("liberar_mesa", (data: { numero: number }) => {
    const mesa = mesas.find((m) => m.numero === data.numero);
    if (mesa) {
      mesa.estado = "libre";
      mesa.items = [];
      mesa.total = 0;
      mesa.clienteNombre = "";
      mesa.nota = "";
      mesa.aperturaHora = undefined;
      mesa.ultimaComandaHora = undefined;
      mesa.pedidoId = undefined;
      io.emit("mesas_actualizadas", mesas);
      saveDatabaseToDisk();
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
    if (socket.data && socket.data.clienteId) {
      const target = clientes.find((c) => c.id === socket.data.clienteId);
      if (target) {
        target.online = false;
        io.emit("clientes_actualizados", clientes);
      }
    }
  });
});

// --- REST API ENDPOINTS ---

// Service Worker script distribution with proper Headers
app.get(["/service-worker.js", "/sw.js"], (req, res) => {
  const fileName = req.path.endsWith("sw.js") ? "sw.js" : "service-worker.js";
  const filePath = path.join(process.cwd(), "public", fileName);
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(filePath);
});

// Registrar suscripción Push
app.post("/api/push/subscribe", (req, res) => {
  const { subscription, clienteEmail } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Suscripción push inválida" });
  }

  const existingIndex = pushSubscriptions.findIndex((s) => s.endpoint === subscription.endpoint);
  const newSub: PushSubscriptionRecord = {
    id: `SUB-${Date.now()}`,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    clienteEmail: clienteEmail || "",
    fechaRegistro: new Date().toISOString(),
  };

  if (existingIndex !== -1) {
    pushSubscriptions[existingIndex] = newSub;
  } else {
    pushSubscriptions.push(newSub);
  }

  res.json({ success: true, message: "Suscripción Push registrada", totalSubscribers: pushSubscriptions.length });
});

// Emitir notificación Push nativa a clientes
app.post("/api/push/send", (req, res) => {
  const { title, body, icon, url, tag, pedidoId } = req.body;
  const payload = {
    title: title || "EL TERNERO Delivery",
    body: body || "Actualización de tu pedido en tiempo real",
    icon: icon || "/scooter.svg",
    badge: "/scooter.svg",
    tag: tag || "el-ternero-alert",
    url: url || "/",
    pedidoId: pedidoId || "",
    timestamp: Date.now(),
  };

  io.emit("notificacion_push_nativa", payload);
  res.json({ success: true, payload, subscribersCount: pushSubscriptions.length });
});

// Configuración del restaurante (Local)
app.get("/api/restaurante", (_req, res) => {
  res.json(restauranteConfig);
});

app.put("/api/restaurante", (req, res) => {
  const { nombre, direccion, latitud, longitud, telefono, logoUrl } = req.body;
  if (nombre) restauranteConfig.nombre = nombre;
  if (direccion) restauranteConfig.direccion = direccion;
  if (latitud !== undefined) restauranteConfig.latitud = Number(latitud);
  if (longitud !== undefined) restauranteConfig.longitud = Number(longitud);
  if (telefono) restauranteConfig.telefono = telefono;
  if (logoUrl !== undefined) restauranteConfig.logoUrl = logoUrl;

  // Actualizar ubicación en pedidos existentes
  pedidos.forEach((p) => {
    p.restauranteNombre = restauranteConfig.nombre;
    p.latitudRestaurante = restauranteConfig.latitud;
    p.longitudRestaurante = restauranteConfig.longitud;
  });

  saveDatabaseToDisk();

  io.emit("config_restaurante_actualizada", restauranteConfig);
  io.emit("logo_actualizado", { logoUrl: restauranteConfig.logoUrl });
  io.emit("pedidos_actualizados", pedidos);

  res.json({ success: true, restauranteConfig });
});

// Obtenemos lista de pedidos
app.get("/api/pedidos", (_req, res) => {
  res.json(pedidos);
});

// Obtenemos un pedido específico
app.get("/api/pedidos/:id", (req, res) => {
  const pedido = pedidos.find((p) => p.id === req.params.id);
  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }
  res.json(pedido);
});

// --- CLIENTES AUTH & REGISTRATION ENDPOINTS ---
app.get("/api/clientes", (_req, res) => {
  res.json(clientes);
});

app.post("/api/clientes/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: "El correo electrónico o número celular es requerido" });
  }

  const cleanQuery = email.trim().toLowerCase();
  const cleanPhone = cleanQuery.replace(/\D/g, '');

  const found = clientes.find((c) => {
    const matchEmail = c.email && c.email.trim().toLowerCase() === cleanQuery;
    const matchCedula = c.cedula && c.cedula.trim().toLowerCase() === cleanQuery;
    const matchPhone = Boolean(cleanPhone && cleanPhone.length >= 6 && c.celular && c.celular.replace(/\D/g, '') === cleanPhone);
    return matchEmail || matchCedula || matchPhone;
  });

  if (!found) {
    return res.json({ success: false, notFound: true, message: "Correo o celular no registrado. Por favor completa tus datos para registrarte." });
  }

  if (found.bloqueado) {
    return res.status(403).json({
      success: false,
      bloqueado: true,
      error: `Tu cuenta ha sido bloqueada/dada de baja por el panel de administración. ${found.motivoBloqueo ? `Motivo: ${found.motivoBloqueo}` : ''}`
    });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: "Por favor ingresa tu contraseña para iniciar sesión" });
  }

  const cleanPass = password.trim();
  if (found.password && found.password !== cleanPass) {
    return res.status(401).json({ success: false, error: "Contraseña incorrecta. Por favor verifica tus datos." });
  }

  // If client had no password yet, assign it
  if (!found.password) {
    found.password = cleanPass;
  }

  found.online = true;
  found.ultimaConexion = new Date().toISOString();
  io.emit("clientes_actualizados", clientes);

  return res.json({ success: true, cliente: found });
});

const isGenericCedula = (val?: string): boolean => {
  if (!val) return true;
  const clean = val.trim().toLowerCase();
  return !clean || clean === 's/c' || clean === 'sin cedula' || clean === 'sin cédula' || clean === '-' || clean === '0';
};

const handleClientRegisterHandler = (req: express.Request, res: express.Response) => {
  const reqBody = req.body || {};
  let nombres = (reqBody.nombres || "").trim();
  let apellidos = (reqBody.apellidos || "").trim();
  const cedula = (reqBody.cedula || "").trim();
  const celular = (reqBody.celular || "").trim();
  const email = (reqBody.email || "").trim().toLowerCase();
  const password = (reqBody.password || "123456").trim();

  // Autodetect full name in 'nombres' if 'apellidos' is empty
  if (nombres && !apellidos) {
    const parts = nombres.split(/\s+/);
    if (parts.length > 1) {
      nombres = parts[0];
      apellidos = parts.slice(1).join(" ");
    }
  }

  if (!nombres || (!celular && !email)) {
    return res.status(400).json({
      error: "Por favor ingresa al menos Tu Nombre y Celular o Correo para completar el registro."
    });
  }

  const cleanEmail = email;
  const cleanCedula = cedula;
  const cleanCelular = celular;
  const cleanPass = password;
  const cleanPhoneDigits = cleanCelular.replace(/\D/g, '');

  let existing = clientes.find((c) => {
    const matchEmail = Boolean(cleanEmail && c.email && c.email.trim().toLowerCase() === cleanEmail);
    const matchCedula = Boolean(
      cleanCedula &&
      !isGenericCedula(cleanCedula) &&
      c.cedula &&
      !isGenericCedula(c.cedula) &&
      c.cedula.trim() === cleanCedula
    );
    const matchPhone = Boolean(
      cleanPhoneDigits &&
      cleanPhoneDigits.length >= 6 &&
      c.celular &&
      c.celular.replace(/\D/g, '') === cleanPhoneDigits
    );
    return matchEmail || matchCedula || matchPhone;
  });

  if (existing) {
    if (existing.bloqueado) {
      return res.status(403).json({
        success: false,
        bloqueado: true,
        error: `No puedes ingresar ni actualizar datos. Esta cuenta/cédula/RUC/teléfono ha sido bloqueada por la administración. ${existing.motivoBloqueo ? `Motivo: ${existing.motivoBloqueo}` : ''}`
      });
    }

    if (nombres) existing.nombres = nombres;
    if (apellidos) existing.apellidos = apellidos;
    if (cleanCedula && !isGenericCedula(cleanCedula)) existing.cedula = cleanCedula;
    if (cleanCelular) existing.celular = cleanCelular;
    if (cleanEmail) existing.email = cleanEmail;
    if (cleanPass) existing.password = cleanPass;

    io.emit("clientes_actualizados", clientes);
    saveDatabaseToDisk();
    return res.json({ success: true, cliente: existing, updated: true });
  }

  const newCliente: Cliente = {
    id: `CLI-${Math.floor(1000 + Math.random() * 9000)}`,
    nombres: nombres || "Cliente",
    apellidos: apellidos || "",
    cedula: cleanCedula || "",
    celular: cleanCelular || "",
    email: cleanEmail || `${cleanPhoneDigits || Date.now()}@cliente.com`,
    password: cleanPass || "123456",
    fechaRegistro: new Date().toISOString(),
    bloqueado: false,
  };

  clientes.push(newCliente);
  io.emit("clientes_actualizados", clientes);
  saveDatabaseToDisk();
  console.log(`[REGISTRO CLIENTE OK] Nuevo cliente registrado desde móvil/web:`, newCliente);
  res.status(201).json({ success: true, cliente: newCliente });
};

app.post("/api/clientes/register", handleClientRegisterHandler);
app.post("/api/clientes/registro", handleClientRegisterHandler);

app.put("/api/clientes/:id/bloquear", (req, res) => {
  const { id } = req.params;
  const { bloqueado, motivoBloqueo } = req.body;
  const cleanId = decodeURIComponent(id).trim();

  const cliente = clientes.find(
    (c) =>
      c.id === cleanId ||
      c.id === id ||
      c.email.trim().toLowerCase() === cleanId.toLowerCase() ||
      c.cedula.trim() === cleanId
  );

  if (!cliente) {
    return res.status(404).json({ error: "Cliente no encontrado" });
  }

  cliente.bloqueado = Boolean(bloqueado);
  if (motivoBloqueo !== undefined) {
    cliente.motivoBloqueo = motivoBloqueo;
  }

  io.emit("clientes_actualizados", clientes);
  saveDatabaseToDisk();
  res.json({ success: true, cliente });
});

app.delete("/api/clientes/:id", (req, res) => {
  const { id } = req.params;
  const cleanId = decodeURIComponent(id).trim();

  const index = clientes.findIndex(
    (c) =>
      c.id === cleanId ||
      c.id === id ||
      c.email.trim().toLowerCase() === cleanId.toLowerCase() ||
      c.cedula.trim() === cleanId
  );

  if (index === -1) {
    return res.status(404).json({ error: "Cliente no encontrado" });
  }

  clientes.splice(index, 1);
  io.emit("clientes_actualizados", clientes);
  saveDatabaseToDisk();
  res.json({ success: true, message: "Cliente eliminado del sistema" });
});

// Crear nuevo pedido
app.post("/api/pedidos", (req, res) => {
  // Google Pay está simulado: se rechaza hasta integrar una pasarela de cobro real.
  if (req.body && req.body.metodoPago === "gpay") {
    return res.status(400).json({ error: "Google Pay no está habilitado. Elegí efectivo o transferencia." });
  }
  const reqEmail = (req.body.clienteEmail || "").trim().toLowerCase();
  const reqCedula = (req.body.clienteCedula || "").trim();
  const reqTelefono = (req.body.telefono || "").trim();
  const reqNombreCompleto = (req.body.cliente || "").trim();

  let matchedClient = null;
  const cleanReqPhone = reqTelefono.replace(/\D/g, '');

  if (reqEmail || (reqCedula && !isGenericCedula(reqCedula)) || (cleanReqPhone && cleanReqPhone.length >= 6)) {
    matchedClient = clientes.find((c) => {
      const matchEmail = Boolean(reqEmail && c.email && c.email.trim().toLowerCase() === reqEmail);
      const matchCedula = Boolean(
        reqCedula &&
        !isGenericCedula(reqCedula) &&
        c.cedula &&
        !isGenericCedula(c.cedula) &&
        c.cedula.trim() === reqCedula
      );
      const matchPhone = Boolean(
        cleanReqPhone &&
        cleanReqPhone.length >= 6 &&
        c.celular &&
        c.celular.replace(/\D/g, '') === cleanReqPhone
      );
      return matchEmail || matchCedula || matchPhone;
    });
    if (matchedClient && matchedClient.bloqueado) {
      return res.status(403).json({
        error: `No es posible procesar el pedido. La cuenta del cliente se encuentra bloqueada por la administración. ${matchedClient.motivoBloqueo ? `Motivo: ${matchedClient.motivoBloqueo}` : ''}`
      });
    }
  }

  // Sincronizar o crear registro en directorio de clientes
  let clientesUpdated = false;

  if (matchedClient) {
    if (reqNombreCompleto && reqNombreCompleto !== "Cliente Nuevo") {
      const parts = reqNombreCompleto.split(" ");
      matchedClient.nombres = parts[0] || matchedClient.nombres;
      matchedClient.apellidos = parts.slice(1).join(" ") || matchedClient.apellidos;
    }
    if (reqTelefono) matchedClient.celular = reqTelefono;
    if (reqEmail) matchedClient.email = reqEmail;
    if (reqCedula) matchedClient.cedula = reqCedula;
    clientesUpdated = true;
  } else if (reqEmail || reqCedula || (reqNombreCompleto && reqNombreCompleto !== "Cliente Nuevo")) {
    const parts = (reqNombreCompleto || "Cliente").split(" ");
    const newCli: Cliente = {
      id: `CLI-${Math.floor(100 + Math.random() * 900)}`,
      nombres: parts[0] || "Cliente",
      apellidos: parts.slice(1).join(" ") || "Registrado",
      cedula: reqCedula || "",
      celular: reqTelefono || "",
      email: reqEmail || "",
      fechaRegistro: new Date().toISOString(),
      bloqueado: false,
    };
    clientes.push(newCli);
    clientesUpdated = true;
  }

  if (clientesUpdated) {
    io.emit("clientes_actualizados", clientes);
  }

  const newPedido: Pedido = {
    id: `PED-${Math.floor(100 + Math.random() * 900)}`,
    cliente: req.body.cliente || "Cliente Nuevo",
    clienteEmail: req.body.clienteEmail || "",
    clienteCedula: req.body.clienteCedula || "",
    telefono: req.body.telefono || "+595 991 000000",
    direccion: req.body.direccion || "Av. España y Perú",
    latitudCliente: req.body.latitudCliente || -25.2900,
    longitudCliente: req.body.longitudCliente || -57.6200,
    restauranteNombre: req.body.restauranteNombre || restauranteConfig.nombre,
    latitudRestaurante: req.body.latitudRestaurante || restauranteConfig.latitud,
    longitudRestaurante: req.body.longitudRestaurante || restauranteConfig.longitud,
    repartidorId: req.body.repartidorId || "REP-123",
    repartidorNombre: req.body.repartidorNombre || "Juan Pérez",
    estado: "recibido",
    notaCliente: req.body.notaCliente || "",
    instruccionOptimizada: req.body.instruccionOptimizada || "",
    items: req.body.items || ["1x Combo Especial Delivery"],
    total: req.body.total || 45000,
    metodoPago: req.body.metodoPago || "efectivo",
    montoPagaCon: req.body.montoPagaCon ? Number(req.body.montoPagaCon) : undefined,
    comprobanteUrl: req.body.comprobanteUrl || "",
    comprobanteNombre: req.body.comprobanteNombre || "",
    comprobanteRevisado: req.body.comprobanteRevisado || false,
    latitudActual: req.body.latitudRestaurante || restauranteConfig.latitud,
    longitudActual: req.body.longitudRestaurante || restauranteConfig.longitud,
    ultimaActualizacion: new Date().toISOString(),
  };

  pedidos.unshift(newPedido);
  io.emit("nuevo_pedido", newPedido);
  io.emit("pedidos_actualizados", pedidos);
  notificarCambioEstadoPedido(newPedido);
  saveDatabaseToDisk();
  res.status(201).json(newPedido);
});

// Actualizar pedido (Aceptar/Rechazar/Escribir detalle) por Admin
app.patch("/api/pedidos/:id", (req, res) => {
  const pedido = pedidos.find((p) => p.id === req.params.id);
  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  const { estado, detallesPedido, repartidorId, repartidorNombre, comprobanteRevisado, comprobanteUrl } = req.body;
  if (estado !== undefined) pedido.estado = estado;
  if (detallesPedido !== undefined) {
    pedido.detallesPedido = detallesPedido;
    pedido.instruccionOptimizada = detallesPedido;
  }
  if (repartidorId !== undefined) pedido.repartidorId = repartidorId;
  if (repartidorNombre !== undefined) pedido.repartidorNombre = repartidorNombre;
  if (comprobanteRevisado !== undefined) pedido.comprobanteRevisado = comprobanteRevisado;
  if (comprobanteUrl !== undefined) pedido.comprobanteUrl = comprobanteUrl;

  io.emit("pedido_actualizado", pedido);
  io.emit("pedidos_actualizados", pedidos);
  notificarCambioEstadoPedido(pedido);
  saveDatabaseToDisk();
  res.json(pedido);
});

// Eliminar pedido por ID
app.delete("/api/pedidos/:id", (req, res) => {
  const index = pedidos.findIndex((p) => p.id === req.params.id);
  if (index !== -1) {
    const deleted = pedidos.splice(index, 1)[0];
    io.emit("pedido_eliminado", req.params.id);
    io.emit("pedidos_actualizados", pedidos);
    saveDatabaseToDisk();
    return res.json({ success: true, id: req.params.id, deleted });
  }
  return res.status(404).json({ error: "Pedido no encontrado" });
});

// Obtenemos lista de repartidores
app.get("/api/repartidores", (_req, res) => {
  res.json(repartidores);
});

// Crear nuevo repartidor
app.post("/api/repartidores", (req, res) => {
  const { nombre, vehiculo, telefono, chapa, usuario, password } = req.body;
  if (!nombre || !usuario || !password) {
    return res.status(400).json({ error: "Nombre, usuario y contraseña son requeridos" });
  }

  const newDriver: Repartidor = {
    id: `REP-${Math.floor(100 + Math.random() * 900)}`,
    nombre,
    vehiculo: vehiculo || "moto",
    telefono: telefono || "+595 981 000000",
    chapa: chapa || "000 XYZ Py",
    usuario: usuario.trim().toLowerCase(),
    password,
    latitud: -25.2867 + (Math.random() - 0.5) * 0.01,
    longitud: -57.6333 + (Math.random() - 0.5) * 0.01,
    disponible: true,
    bateria: 100,
  };

  repartidores.push(newDriver);
  io.emit("repartidores_actualizados", repartidores);
  saveDatabaseToDisk();
  res.status(201).json(newDriver);
});

// Editar repartidor
app.put("/api/repartidores/:id", (req, res) => {
  const driver = repartidores.find((r) => r.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ error: "Repartidor no encontrado" });
  }

  const { nombre, vehiculo, telefono, chapa, usuario, password, disponible } = req.body;
  if (nombre) driver.nombre = nombre;
  if (vehiculo) driver.vehiculo = vehiculo;
  if (telefono) driver.telefono = telefono;
  if (chapa !== undefined) driver.chapa = chapa;
  if (usuario) driver.usuario = usuario.trim().toLowerCase();
  if (password) driver.password = password;
  if (disponible !== undefined) driver.disponible = disponible;

  io.emit("repartidores_actualizados", repartidores);
  saveDatabaseToDisk();
  res.json(driver);
});

// Eliminar repartidor
app.delete("/api/repartidores/:id", (req, res) => {
  const index = repartidores.findIndex((r) => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Repartidor no encontrado" });
  }

  const removed = repartidores.splice(index, 1)[0];
  io.emit("repartidor_eliminado", req.params.id);
  io.emit("repartidores_actualizados", repartidores);
  saveDatabaseToDisk();
  res.json({ success: true, removed });
});

// Login de repartidor con usuario y contraseña
app.post("/api/repartidores/login", (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: "Debe proveer usuario y contraseña" });
  }

  const driver = repartidores.find(
    (r) =>
      (r.usuario && r.usuario.toLowerCase() === usuario.trim().toLowerCase()) &&
      r.password === password
  );

  if (!driver) {
    return res.status(401).json({ error: "Usuario o contraseña de repartidor incorrectos" });
  }

  res.json({
    success: true,
    repartidor: driver,
  });
});

// --- PLANTILLAS DE NOTIFICACIONES ---
app.get("/api/notification-templates", (_req, res) => {
  res.json(notificationTemplates);
});

app.put("/api/notification-templates", (req, res) => {
  if (req.body) {
    notificationTemplates = { ...notificationTemplates, ...req.body };
    io.emit("notification_templates_updated", notificationTemplates);
    saveDatabaseToDisk();
    res.json({ success: true, notificationTemplates });
  } else {
    res.status(400).json({ error: "Datos no provistos" });
  }
});

// --- BROADCAST PROMO / COMBOS DEL DÍA ---
app.post("/api/notifications/broadcast-promo", (req, res) => {
  const { title, body, imageUrl, productoId } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: "Título y mensaje de la promoción son requeridos" });
  }

  const payload = {
    title: title.trim(),
    body: body.trim(),
    icon: imageUrl || "/scooter.svg",
    badge: "/scooter.svg",
    tag: `promo-${Date.now()}`,
    url: productoId ? `/?promoProduct=${productoId}` : `/?promo=1`,
    timestamp: Date.now(),
    isPromo: true,
    productoId: productoId || null,
  };

  // Emitir a todos los clientes conectados
  io.emit("alerta_promocion_combo", payload);
  io.emit("notificacion_push_nativa", payload);

  res.json({ success: true, payload });
});

// --- PRODUCTOS ENDPOINTS (ADMIN) ---
// Obtener lista de productos
app.get("/api/productos", (_req, res) => {
  res.json(productos);
});

// Crear o actualizar un producto
app.post("/api/productos", (req, res) => {
  const { nombre, cantidad, monto, fotoUrl, categoria, descripcion } = req.body;

  if (!nombre || monto === undefined || cantidad === undefined) {
    return res.status(400).json({ error: "Faltan datos obligatorios (nombre, cantidad, monto)" });
  }

  const newProduct: Producto = {
    id: `PROD-${Math.floor(100 + Math.random() * 900)}`,
    nombre: nombre.trim(),
    cantidad: Number(cantidad) || 0,
    monto: Number(monto) || 0,
    fotoUrl: fotoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
    categoria: categoria || "General",
    descripcion: descripcion || "",
  };

  productos.unshift(newProduct);
  io.emit("producto_creado", newProduct);
  io.emit("productos_actualizados", productos);
  saveDatabaseToDisk();
  res.status(201).json(newProduct);
});

// Editar un producto
app.put("/api/productos/:id", (req, res) => {
  const prod = productos.find((p) => p.id === req.params.id);
  if (!prod) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  const { nombre, cantidad, monto, fotoUrl, categoria, descripcion } = req.body;
  if (nombre) prod.nombre = nombre.trim();
  if (cantidad !== undefined) prod.cantidad = Number(cantidad) || 0;
  if (monto !== undefined) prod.monto = Number(monto) || 0;
  if (fotoUrl) prod.fotoUrl = fotoUrl;
  if (categoria) prod.categoria = categoria;
  if (descripcion !== undefined) prod.descripcion = descripcion;

  io.emit("producto_actualizado", prod);
  io.emit("productos_actualizados", productos);
  saveDatabaseToDisk();
  res.json(prod);
});

// Eliminar un producto
app.delete("/api/productos/:id", (req, res) => {
  const index = productos.findIndex((p) => p.id === req.params.id);
  if (index !== -1) {
    const deleted = productos.splice(index, 1);
    io.emit("producto_eliminado", req.params.id);
    io.emit("productos_actualizados", productos);
    saveDatabaseToDisk();
    return res.json({ success: true, deleted: deleted[0] });
  }
  res.status(404).json({ error: "Producto no encontrado" });
});

// --- CATEGORÍAS PORTADAS Y ESTADO (PORTADAS Y HABILITAR/DESHABILITAR CATEGORÍAS) ---

// Obtener todas las portadas de categorías
app.get("/api/categorias/portadas", (_req, res) => {
  res.json(categoriasPortadas);
});

// Obtener estado de categorías (habilitada/deshabilitada)
app.get("/api/categorias/estado", (_req, res) => {
  res.json(categoriasEstado);
});

// Crear una nueva categoría de producto
app.post("/api/categorias", (req, res) => {
  const { nombre, fotoUrl } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: "El nombre de la categoría es obligatorio." });
  }
  const catNombre = nombre.trim();
  if (categoriasEstado[catNombre] === undefined) {
    categoriasEstado[catNombre] = true;
  }
  if (fotoUrl) {
    categoriasPortadas[catNombre] = fotoUrl;
  } else if (!categoriasPortadas[catNombre]) {
    categoriasPortadas[catNombre] = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
  }

  io.emit("categorias_estado_actualizadas", categoriasEstado);
  io.emit("categorias_portadas_actualizadas", categoriasPortadas);
  saveDatabaseToDisk();
  res.json({ success: true, nombre: catNombre, categoriasEstado, categoriasPortadas });
});

// Actualizar estado de una categoría
app.put("/api/categorias/estado/:id", (req, res) => {
  const { id } = req.params;
  const { activa } = req.body;
  categoriasEstado[id] = activa !== false;
  io.emit("categorias_estado_actualizadas", categoriasEstado);
  saveDatabaseToDisk();
  res.json({ success: true, id, activa: categoriasEstado[id], categoriasEstado });
});

// Actualizar la portada de una categoría
app.put("/api/categorias/portadas/:id", (req, res) => {
  const { id } = req.params;
  const { fotoUrl } = req.body;
  if (!fotoUrl) {
    return res.status(400).json({ error: "fotoUrl es requerida" });
  }
  categoriasPortadas[id] = fotoUrl;
  io.emit("categorias_portadas_actualizadas", categoriasPortadas);
  saveDatabaseToDisk();
  res.json({ success: true, id, fotoUrl, categoriasPortadas });
});

// Renombrar una categoría de producto
app.put("/api/categorias/renombrar/:id", (req, res) => {
  const oldId = req.params.id;
  const { nuevoNombre } = req.body;
  if (!nuevoNombre || !nuevoNombre.trim()) {
    return res.status(400).json({ error: "El nuevo nombre es requerido." });
  }
  const newName = nuevoNombre.trim();

  if (oldId === newName) {
    return res.json({ success: true, message: "El nombre es idéntico.", categoriasPortadas, categoriasEstado });
  }

  // Transferir portada y estado a la nueva clave
  if (categoriasPortadas[oldId] !== undefined) {
    categoriasPortadas[newName] = categoriasPortadas[oldId];
    delete categoriasPortadas[oldId];
  } else {
    categoriasPortadas[newName] = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
  }

  if (categoriasEstado[oldId] !== undefined) {
    categoriasEstado[newName] = categoriasEstado[oldId];
    delete categoriasEstado[oldId];
  } else {
    categoriasEstado[newName] = true;
  }

  // Actualizar la categoría en todos los productos existentes
  let prodCount = 0;
  productos.forEach((p) => {
    if (p.categoria === oldId) {
      p.categoria = newName;
      prodCount++;
    }
  });

  io.emit("categorias_estado_actualizadas", categoriasEstado);
  io.emit("categorias_portadas_actualizadas", categoriasPortadas);
  if (prodCount > 0) {
    io.emit("productos_actualizados", productos);
  }
  saveDatabaseToDisk();

  res.json({
    success: true,
    oldId,
    newName,
    productosActualizados: prodCount,
    categoriasPortadas,
    categoriasEstado,
  });
});

// Eliminar por completo una categoría de producto
app.delete("/api/categorias/:id", (req, res) => {
  const { id } = req.params;

  delete categoriasPortadas[id];
  delete categoriasEstado[id];

  // Reasignar productos que pertenecían a la categoría eliminada a "General"
  let prodCount = 0;
  productos.forEach((p) => {
    if (p.categoria === id) {
      p.categoria = "General";
      prodCount++;
    }
  });

  // Asegurar que exista "General" en el mapa de estados y portadas
  if (categoriasEstado["General"] === undefined) {
    categoriasEstado["General"] = true;
  }
  if (!categoriasPortadas["General"]) {
    categoriasPortadas["General"] = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
  }

  io.emit("categorias_estado_actualizadas", categoriasEstado);
  io.emit("categorias_portadas_actualizadas", categoriasPortadas);
  io.emit("productos_actualizados", productos);
  saveDatabaseToDisk();

  res.json({
    success: true,
    idEliminado: id,
    productosReasignados: prodCount,
    categoriasPortadas,
    categoriasEstado,
  });
});

// Eliminar/restablecer portada de una categoría
app.delete("/api/categorias/portadas/:id", (req, res) => {
  const { id } = req.params;
  categoriasPortadas[id] = "";
  io.emit("categorias_portadas_actualizadas", categoriasPortadas);
  saveDatabaseToDisk();
  res.json({ success: true, id, categoriasPortadas });
});

// --- CIERRE DE CAJA ENDPOINTS (ADMIN) ---
// Obtener todos los cierres de caja registrados
app.get("/api/cierres", (_req, res) => {
  res.json(cierresDeCaja);
});

// Registrar un nuevo Cierre de Caja
app.post("/api/cierres", (req, res) => {
  const { montoInicial, observaciones, usuarioCierre } = req.body;

  // Filtrar todos los pedidos entregados actualmente en el sistema
  const pedidosEntregados = pedidos.filter((p) => p.estado === "entregado");

  const totalVentasCalculado = pedidosEntregados.reduce((acc, p) => acc + (p.total || 0), 0);

  const nuevoCierre: CierreDeCaja = {
    id: `CIERRE-${new Date().toISOString().slice(0, 10)}-${Math.floor(10 + Math.random() * 90)}`,
    fechaInicio: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    fechaCierre: new Date().toISOString(),
    montoInicial: Number(montoInicial) || 0,
    totalVentas: totalVentasCalculado,
    cantidadPedidos: pedidosEntregados.length,
    observaciones: observaciones || "Cierre de caja registrado correctamente.",
    usuarioCierre: usuarioCierre || "Administrador",
    pedidos: pedidosEntregados.map((p) => ({
      id: p.id,
      fecha: p.ultimaActualizacion || new Date().toISOString(),
      cliente: p.cliente,
      repartidorId: p.repartidorId,
      repartidorNombre: p.repartidorNombre,
      items: p.items || [],
      total: p.total || 0,
    })),
  };

  cierresDeCaja.unshift(nuevoCierre);
  io.emit("cierre_realizado", nuevoCierre);
  io.emit("cierres_actualizados", cierresDeCaja);
  saveDatabaseToDisk();

  res.status(201).json({ success: true, cierre: nuevoCierre });
});

// Eliminar un registro de cierre de caja (si es necesario por corrección)
app.delete("/api/cierres/:id", (req, res) => {
  const index = cierresDeCaja.findIndex((c) => c.id === req.params.id);
  if (index !== -1) {
    cierresDeCaja.splice(index, 1);
    io.emit("cierres_actualizados", cierresDeCaja);
    saveDatabaseToDisk();
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Cierre no encontrado" });
});

// --- MÓDULO DE MOZOS Y GESTIÓN DE 15 MESAS DE SALÓN ---

// Obtener todas las 15 mesas
app.get("/api/mesas", (_req, res) => {
  res.json(mesas);
});

// Obtener detalle de una mesa por su número
app.get("/api/mesas/:numero", (req, res) => {
  const num = Number(req.params.numero);
  const mesa = mesas.find((m) => m.numero === num);
  if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });
  res.json(mesa);
});

// Abrir u ocupar mesa
app.post("/api/mesas/:numero/abrir", (req, res) => {
  const num = Number(req.params.numero);
  const mesa = mesas.find((m) => m.numero === num);
  if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });

  const { mozoAsignado, clienteNombre, capacidad, nota } = req.body;
  mesa.estado = "ocupada";
  mesa.mozoAsignado = mozoAsignado || mesa.mozoAsignado || "Mozo de Salón";
  mesa.clienteNombre = clienteNombre || "";
  mesa.nota = nota || "";
  if (capacidad) mesa.capacidad = Number(capacidad);
  mesa.aperturaHora = new Date().toISOString();
  if (!mesa.items) mesa.items = [];

  io.emit("mesas_actualizadas", mesas);
  saveDatabaseToDisk();
  res.json({ success: true, mesa });
});

// Agregar o enviar comanda a Cocina desde una mesa
app.post("/api/mesas/:numero/comanda", (req, res) => {
  const num = Number(req.params.numero);
  const mesa = mesas.find((m) => m.numero === num);
  if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });

  const { items, mozoAsignado, clienteNombre, nota } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Debe agregar al menos un producto a la comanda" });
  }

  mesa.estado = "ocupada";
  if (mozoAsignado) mesa.mozoAsignado = mozoAsignado;
  if (clienteNombre) mesa.clienteNombre = clienteNombre;
  if (nota !== undefined) mesa.nota = nota;
  if (!mesa.aperturaHora) mesa.aperturaHora = new Date().toISOString();
  mesa.ultimaComandaHora = new Date().toISOString();

  // Agregar ítems a la mesa
  items.forEach((it: ItemComandaMesa) => {
    const existing = mesa.items.find(
      (mIt) => mIt.productoId === it.productoId && (mIt.observacion || "") === (it.observacion || "")
    );
    if (existing) {
      existing.cantidad += it.cantidad;
      existing.subtotal = existing.cantidad * existing.precioUnitario;
    } else {
      mesa.items.push({
        id: `MITEM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        productoId: it.productoId,
        nombre: it.nombre,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        subtotal: it.cantidad * it.precioUnitario,
        observacion: it.observacion || "",
        agregadoEn: new Date().toISOString(),
      });
    }
  });

  mesa.total = mesa.items.reduce((sum, it) => sum + (it.subtotal || 0), 0);

  // Crear o actualizar Pedido de cocina para el KDS de Cocina
  let pedidoCocina = pedidos.find((p) => p.id === mesa.pedidoId && p.estado !== "entregado" && p.estado !== "rechazado");
  const itemsTextArray = mesa.items.map((it) =>
    `${it.cantidad}x ${it.nombre}${it.observacion ? ` [${it.observacion}]` : ""}`
  );

  if (!pedidoCocina) {
    const newPedidoId = `MS-${String(mesa.numero).padStart(2, "0")}-${Math.floor(100 + Math.random() * 900)}`;
    pedidoCocina = {
      id: newPedidoId,
      cliente: `Mesa #${mesa.numero}${mesa.clienteNombre ? ` (${mesa.clienteNombre})` : ""}`,
      telefono: mesa.mozoAsignado || "Mozo de Salón",
      direccion: `SALÓN • MESA #${mesa.numero}`,
      latitudCliente: restauranteConfig.latitud,
      longitudCliente: restauranteConfig.longitud,
      restauranteNombre: restauranteConfig.nombre,
      latitudRestaurante: restauranteConfig.latitud,
      longitudRestaurante: restauranteConfig.longitud,
      repartidorId: "MOZO",
      repartidorNombre: mesa.mozoAsignado || "Servicio en Salón",
      estado: "aceptado",
      notaCliente: `COMANDO DE SALÓN • MESA #${mesa.numero} • Mozo: ${mesa.mozoAsignado || "Salón"}${mesa.nota ? ` • Nota: ${mesa.nota}` : ""}`,
      detallesPedido: `Mesa #${mesa.numero} • Comanda en Vivo`,
      items: itemsTextArray,
      total: mesa.total,
      metodoPago: "efectivo",
      tipoPedido: "salon",
      mesaNumero: mesa.numero,
      mozoNombre: mesa.mozoAsignado || "Mozo",
      ultimaActualizacion: new Date().toISOString(),
    };
    mesa.pedidoId = newPedidoId;
    pedidos.unshift(pedidoCocina);
    io.emit("nuevo_pedido", pedidoCocina);
  } else {
    pedidoCocina.items = itemsTextArray;
    pedidoCocina.total = mesa.total;
    pedidoCocina.repartidorNombre = mesa.mozoAsignado || "Servicio en Salón";
    pedidoCocina.mozoNombre = mesa.mozoAsignado || "Mozo";
    pedidoCocina.notaCliente = `COMANDO DE SALÓN • MESA #${mesa.numero} • Mozo: ${mesa.mozoAsignado || "Salón"}${mesa.nota ? ` • Nota: ${mesa.nota}` : ""}`;
    pedidoCocina.ultimaActualizacion = new Date().toISOString();
    // Si estaba listo y pidieron más, vuelve a aceptado para alertar a cocina
    if (pedidoCocina.estado === "comanda_lista") {
      pedidoCocina.estado = "aceptado";
    }
    io.emit("pedido_actualizado", pedidoCocina);
  }

  io.emit("mesas_actualizadas", mesas);
  io.emit("pedidos_actualizados", pedidos);
  saveDatabaseToDisk();
  res.json({ success: true, mesa, pedidoCocina });
});

// Solicitar Pre-Cuenta / Cuenta de la Mesa
app.post("/api/mesas/:numero/cuenta", (req, res) => {
  const num = Number(req.params.numero);
  const mesa = mesas.find((m) => m.numero === num);
  if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });

  mesa.estado = "cuenta_pedida";
  io.emit("mesas_actualizadas", mesas);
  saveDatabaseToDisk();
  res.json({ success: true, mesa });
});

// Cobrar y Cerrar Mesa
app.post("/api/mesas/:numero/cobrar", (req, res) => {
  const num = Number(req.params.numero);
  const mesa = mesas.find((m) => m.numero === num);
  if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });

  const { metodoPago, montoPagaCon } = req.body;
  const metodo = metodoPago || "efectivo";

  // Si tiene un pedido de cocina asociado, marcarlo como entregado
  if (mesa.pedidoId) {
    const ped = pedidos.find((p) => p.id === mesa.pedidoId);
    if (ped) {
      ped.estado = "entregado";
      ped.metodoPago = metodo;
      ped.montoPagaCon = montoPagaCon ? Number(montoPagaCon) : undefined;
      ped.ultimaActualizacion = new Date().toISOString();
      io.emit("pedido_actualizado", ped);
    }
  }

  // Guardar copia del cierre de mesa para respuesta
  const resumenCobro = {
    mesaNumero: mesa.numero,
    cliente: mesa.clienteNombre || `Mesa #${mesa.numero}`,
    mozo: mesa.mozoAsignado || "Mozo",
    items: [...mesa.items],
    total: mesa.total,
    metodoPago: metodo,
    fechaCobro: new Date().toISOString(),
  };

  // Liberar la mesa
  mesa.estado = "libre";
  mesa.items = [];
  mesa.total = 0;
  mesa.clienteNombre = "";
  mesa.nota = "";
  mesa.aperturaHora = undefined;
  mesa.ultimaComandaHora = undefined;
  mesa.pedidoId = undefined;

  io.emit("mesas_actualizadas", mesas);
  io.emit("pedidos_actualizados", pedidos);
  saveDatabaseToDisk();

  res.json({ success: true, resumenCobro, mesa });
});

// Liberar Mesa sin cobrar (cancelar / desocupar)
app.post("/api/mesas/:numero/liberar", (req, res) => {
  const num = Number(req.params.numero);
  const mesa = mesas.find((m) => m.numero === num);
  if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });

  if (mesa.pedidoId) {
    const ped = pedidos.find((p) => p.id === mesa.pedidoId);
    if (ped && ped.estado !== "entregado") {
      ped.estado = "rechazado";
      io.emit("pedido_actualizado", ped);
    }
  }

  mesa.estado = "libre";
  mesa.items = [];
  mesa.total = 0;
  mesa.clienteNombre = "";
  mesa.nota = "";
  mesa.aperturaHora = undefined;
  mesa.ultimaComandaHora = undefined;
  mesa.pedidoId = undefined;

  io.emit("mesas_actualizadas", mesas);
  io.emit("pedidos_actualizados", pedidos);
  saveDatabaseToDisk();
  res.json({ success: true, mesa });
});

// Transferir mesa (mover de Mesa A a Mesa B)
app.post("/api/mesas/:numero/transferir", (req, res) => {
  const origenNum = Number(req.params.numero);
  const destinoNum = Number(req.body.destinoNumero);

  const origen = mesas.find((m) => m.numero === origenNum);
  const destino = mesas.find((m) => m.numero === destinoNum);

  if (!origen || !destino) {
    return res.status(404).json({ error: "Mesa origen o destino no encontrada" });
  }

  if (origen.estado === "libre") {
    return res.status(400).json({ error: "La mesa origen está libre, no hay nada que transferir" });
  }

  // Transferir datos
  destino.estado = "ocupada";
  destino.mozoAsignado = origen.mozoAsignado;
  destino.clienteNombre = origen.clienteNombre;
  destino.nota = origen.nota;
  destino.aperturaHora = origen.aperturaHora || new Date().toISOString();
  destino.ultimaComandaHora = origen.ultimaComandaHora;
  destino.items = [...origen.items];
  destino.total = origen.total;
  destino.pedidoId = origen.pedidoId;

  // Actualizar pedido en cocina si existe
  if (destino.pedidoId) {
    const ped = pedidos.find((p) => p.id === destino.pedidoId);
    if (ped) {
      ped.cliente = `Mesa #${destino.numero}${destino.clienteNombre ? ` (${destino.clienteNombre})` : ""}`;
      ped.direccion = `SALÓN • MESA #${destino.numero}`;
      ped.mesaNumero = destino.numero;
      ped.notaCliente = `COMANDO DE SALÓN • MESA #${destino.numero} (Transferida de Mesa #${origen.numero}) • Mozo: ${destino.mozoAsignado || "Salón"}`;
      io.emit("pedido_actualizado", ped);
    }
  }

  // Liberar mesa origen
  origen.estado = "libre";
  origen.items = [];
  origen.total = 0;
  origen.clienteNombre = "";
  origen.nota = "";
  origen.aperturaHora = undefined;
  origen.ultimaComandaHora = undefined;
  origen.pedidoId = undefined;

  io.emit("mesas_actualizadas", mesas);
  io.emit("pedidos_actualizados", pedidos);
  saveDatabaseToDisk();

  res.json({ success: true, origen, destino });
});

// --- 2. INTEGRACIÓN CON GEMINI (AI STUDIO) ---
// Endpoint para resumir o limpiar las instrucciones de entrega para el repartidor
app.post("/api/ia/resumir-instrucciones", async (req, res) => {
  try {
    const { notaCliente } = req.body;

    if (!notaCliente || typeof notaCliente !== "string" || !notaCliente.trim()) {
      return res.json({ instruccionOptimizada: "Sin instrucciones especiales de entrega." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackText = notaCliente.slice(0, 80) + (notaCliente.length > 80 ? "..." : "");
      return res.json({ instruccionOptimizada: fallbackText, fallback: true });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Eres un asistente de delivery. Resume la siguiente nota del cliente en una instrucción clave y concisa de máximo 15 palabras para el repartidor:\n"${notaCliente}"`,
    });

    const outputText = response.text ? response.text.trim() : notaCliente;
    res.json({ instruccionOptimizada: outputText });
  } catch (error) {
    console.error("Error con Gemini API:", error);
    // Fallback inteligente si falla o no hay API key configurada
    const fallbackText = req.body.notaCliente
      ? req.body.notaCliente.slice(0, 80) + (req.body.notaCliente.length > 80 ? "..." : "")
      : "Entregar según indicaciones del cliente.";
    res.status(200).json({ instruccionOptimizada: fallbackText, fallback: true });
  }
});

// IA extra: Análisis de ruta inteligente y tips de entrega
app.post("/api/ia/analizar-entrega", async (req, res) => {
  try {
    const { pedidoId, direccion, items } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ tips: ["Mantener caliente la comida en la mochila térmica", "Confirmar el nombre del cliente antes de entregar"] });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Proporciona 2 consejos ultracortos para el repartidor para el pedido en ${direccion} con items ${JSON.stringify(
        items
      )}. Responde en formato JSON array de strings con máximo 2 items.`,
      config: {
        responseMimeType: "application/json",
      },
    });

    res.json({ tips: JSON.parse(response.text || "[]") });
  } catch (err) {
    res.json({ tips: ["Mantener caliente la comida en la mochila térmica", "Confirmar el nombre del cliente antes de entregar"] });
  }
});

// Servidor estático y Vite Middleware
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Delivery listo en puerto ${PORT}`);
  });
}

startServer();
