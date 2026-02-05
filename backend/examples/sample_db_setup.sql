-- Sample Database Setup for ADK.js Agent System
-- Run this script to create example tables for testing

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  city VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending'
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL
);

-- Sample data for customers
INSERT INTO customers (name, email, city, country) VALUES
  ('John Smith', 'john@example.com', 'New York', 'USA'),
  ('Jane Doe', 'jane@example.com', 'London', 'UK'),
  ('Bob Johnson', 'bob@example.com', 'Toronto', 'Canada'),
  ('Alice Williams', 'alice@example.com', 'Sydney', 'Australia'),
  ('Charlie Brown', 'charlie@example.com', 'Berlin', 'Germany'),
  ('Diana Prince', 'diana@example.com', 'Paris', 'France'),
  ('Eve Martinez', 'eve@example.com', 'Madrid', 'Spain'),
  ('Frank Wilson', 'frank@example.com', 'Amsterdam', 'Netherlands'),
  ('Grace Lee', 'grace@example.com', 'Tokyo', 'Japan'),
  ('Henry Chen', 'henry@example.com', 'Shanghai', 'China');

-- Sample data for products
INSERT INTO products (name, category, price, stock_quantity) VALUES
  ('Laptop', 'Electronics', 999.99, 50),
  ('Mouse', 'Electronics', 29.99, 200),
  ('Keyboard', 'Electronics', 79.99, 150),
  ('Monitor', 'Electronics', 299.99, 75),
  ('Desk Chair', 'Furniture', 199.99, 40),
  ('Standing Desk', 'Furniture', 499.99, 30),
  ('USB Cable', 'Accessories', 9.99, 500),
  ('Webcam', 'Electronics', 79.99, 100),
  ('Headphones', 'Electronics', 149.99, 120),
  ('Desk Lamp', 'Furniture', 49.99, 80);

-- Sample data for orders
INSERT INTO orders (customer_id, total_amount, status) VALUES
  (1, 1299.97, 'completed'),
  (2, 399.98, 'completed'),
  (3, 2499.96, 'completed'),
  (4, 149.99, 'pending'),
  (5, 559.98, 'completed'),
  (6, 1099.99, 'shipped'),
  (7, 99.98, 'completed'),
  (8, 279.98, 'pending'),
  (9, 699.97, 'completed'),
  (10, 1349.97, 'shipped');

-- Sample data for order_items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 999.99),
  (1, 2, 1, 29.99),
  (1, 7, 10, 9.99),
  (2, 3, 1, 79.99),
  (2, 8, 4, 79.99),
  (3, 1, 2, 999.99),
  (3, 5, 1, 199.99),
  (4, 9, 1, 149.99),
  (5, 4, 1, 299.99),
  (5, 10, 5, 49.99),
  (6, 1, 1, 999.99),
  (6, 3, 1, 79.99),
  (6, 2, 1, 29.99),
  (7, 7, 10, 9.99),
  (8, 8, 3, 79.99),
  (9, 6, 1, 499.99),
  (9, 10, 4, 49.99),
  (10, 1, 1, 999.99),
  (10, 5, 1, 199.99),
  (10, 3, 1, 79.99);

-- Create indexes for performance
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Example queries for testing:
-- SELECT * FROM customers;
-- SELECT * FROM products WHERE price > 100;
-- SELECT customer_id, COUNT(*) as order_count, SUM(total_amount) as total_spent FROM orders GROUP BY customer_id;
-- SELECT p.name, SUM(oi.quantity) as total_sold FROM order_items oi JOIN products p ON oi.product_id = p.id GROUP BY p.name ORDER BY total_sold DESC;
