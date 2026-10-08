export type MenuItem = {
  path: string;
  name: string;
  icon?: string;
  isNavigate?: boolean;
  children?: MenuItem[];
};

export const routes = {
  home: "/",

  admin: {
    dashboard: "/admin",
    event: {
      list: "/admin/event",
      create: "/admin/event/new",
      detail: (id: string) => `/admin/event/${id}`,
    },

    category: {
      list: "/admin/category",
    },

    brand: {
      list: "/admin/brand",
    },

    product: {
      list: "/admin/product",

      create: "/admin/product/new",

      detail: (id: string | number) => `/admin/product/${id}`,
    },

    warehouse: {
      list: "/admin/warehouse",
    },

    warehouseInventory: {
      list: "/admin/warehouse-inventory",
    },

    attribute: {
      list: "/admin/attribute",
    },

    order: {
      list: "/admin/order",
      detail: (id: string | number) => `/admin/order/${id}`,
    },
  },
} as const;

export const adminMenus: MenuItem[] = [
  {
    path: routes.admin.event.list,
    name: "Sự kiện",
    icon: "event_rounded",
    isNavigate: true,
  },
  {
    path: routes.admin.dashboard,
    name: "Dashboard",
    icon: "space_dashboard_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.category.list,
    name: "Danh mục",
    icon: "category_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.brand.list,
    name: "Thương hiệu",
    icon: "workspace_premium_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.attribute.list,
    name: "Thuộc tính",
    icon: "tune_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.product.list,
    name: "Sản phẩm",
    icon: "inventory_2_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.order.list,
    name: "Đơn hàng",
    icon: "receipt_long_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.warehouse.list,
    name: "Kho hàng",
    icon: "warehouse_rounded",
    isNavigate: true,
  },

  {
    path: routes.admin.warehouseInventory.list,
    name: "Tồn kho",
    icon: "inventory_rounded",
    isNavigate: true,
  },
];
