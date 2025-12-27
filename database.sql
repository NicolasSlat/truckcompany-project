CREATE DATABASE transport_company;
USE transport_company;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100),
  password VARCHAR(100),
  role VARCHAR(20)
);

CREATE TABLE trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plate_no VARCHAR(50),
  owner VARCHAR(100),
  contact VARCHAR(50),
  insurance VARCHAR(100),
  status VARCHAR(20),
  branch VARCHAR(100)
);

CREATE TABLE contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  message TEXT
);