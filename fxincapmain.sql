-- MySQL dump 10.13  Distrib 8.4.6-6, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: fxincapmain
-- ------------------------------------------------------
-- Server version	8.4.6-6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!50717 SELECT COUNT(*) INTO @rocksdb_has_p_s_session_variables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'performance_schema' AND TABLE_NAME = 'session_variables' */;
/*!50717 SET @rocksdb_get_is_supported = IF (@rocksdb_has_p_s_session_variables, 'SELECT COUNT(*) INTO @rocksdb_is_supported FROM performance_schema.session_variables WHERE VARIABLE_NAME=\'rocksdb_bulk_load\'', 'SELECT 0') */;
/*!50717 PREPARE s FROM @rocksdb_get_is_supported */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;
/*!50717 SET @rocksdb_enable_bulk_load = IF (@rocksdb_is_supported, 'SET SESSION rocksdb_bulk_load = 1', 'SET @rocksdb_dummy_bulk_load = 0') */;
/*!50717 PREPARE s FROM @rocksdb_enable_bulk_load */;
/*!50717 EXECUTE s */;
/*!50717 DEALLOCATE PREPARE s */;

--
-- Table structure for table `account_tiers`
--

DROP TABLE IF EXISTS `account_tiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_tiers` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `min_balance` decimal(15,2) DEFAULT NULL,
  `max_leverage` int DEFAULT NULL,
  `daily_deposit_limit` decimal(15,2) DEFAULT NULL,
  `monthly_deposit_limit` decimal(15,2) DEFAULT NULL,
  `commission_rate` decimal(5,3) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_tiers`
--

LOCK TABLES `account_tiers` WRITE;
/*!40000 ALTER TABLE `account_tiers` DISABLE KEYS */;
INSERT INTO `account_tiers` VALUES ('358e0cf8-d6b8-11f0-866d-fabefe9bbf2d','Standard','Standard trading account',100.00,500,10000.00,50000.00,0.001,'2025-12-11 17:38:30'),('3595dad9-d6b8-11f0-866d-fabefe9bbf2d','Professional','Professional trading account',1000.00,1000,50000.00,200000.00,0.001,'2025-12-11 17:38:30'),('3595e578-d6b8-11f0-866d-fabefe9bbf2d','VIP','VIP trading account',10000.00,1500,100000.00,500000.00,0.000,'2025-12-11 17:38:30');
/*!40000 ALTER TABLE `account_tiers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_activity_logs`
--

DROP TABLE IF EXISTS `admin_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_activity_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_user_activity` (`admin_user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `admin_activity_logs_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_activity_logs`
--

LOCK TABLES `admin_activity_logs` WRITE;
/*!40000 ALTER TABLE `admin_activity_logs` DISABLE KEYS */;
INSERT INTO `admin_activity_logs` VALUES (30,'f58c195d-a769-44a2-b0be-e990716da38b','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',NULL,'2025-12-29 15:46:50'),(31,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',NULL,'2026-01-10 12:51:32'),(32,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',NULL,'2026-02-08 18:08:55'),(33,'f58c195d-a769-44a2-b0be-e990716da38b','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',NULL,'2026-02-09 16:51:35'),(34,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-09 16:51:37'),(35,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-13 18:57:49'),(36,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-16 18:03:21'),(37,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-17 19:35:49'),(38,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-18 13:17:37'),(39,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-19 06:30:32'),(40,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-19 06:46:52'),(41,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',NULL,'2026-02-23 17:17:42'),(42,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',NULL,'2026-02-26 02:00:14'),(43,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',NULL,'2026-03-17 10:34:47'),(44,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',NULL,'2026-03-18 18:12:33'),(45,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',NULL,'2026-03-19 09:39:28'),(46,'d895301a-35c0-42d7-80b5-70b6e340a1c0','login','Admin logged in successfully','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',NULL,'2026-03-19 13:56:18');
/*!40000 ALTER TABLE `admin_activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_devices`
--

DROP TABLE IF EXISTS `admin_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_devices` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `admin_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_fingerprint` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `browser` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `os` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_trusted` tinyint(1) DEFAULT '0',
  `last_used_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_device` (`admin_user_id`,`device_fingerprint`),
  KEY `idx_admin_user_device` (`admin_user_id`),
  KEY `idx_device_fingerprint` (`device_fingerprint`),
  KEY `idx_is_trusted` (`is_trusted`),
  CONSTRAINT `admin_devices_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_devices`
--

LOCK TABLES `admin_devices` WRITE;
/*!40000 ALTER TABLE `admin_devices` DISABLE KEYS */;
INSERT INTO `admin_devices` VALUES ('010f7026-8077-4804-8d4b-c5c17b578053','f58c195d-a769-44a2-b0be-e990716da38b','dev-22f58303','Win32','Safari/537.36','Win32','::ffff:127.0.0.1',1,'2025-12-29 15:46:49','2025-12-26 15:28:42','2025-12-29 15:46:49'),('2ce15229-034f-42cf-9393-4b18f1bcd748','d895301a-35c0-42d7-80b5-70b6e340a1c0','dev-ac8ecb71','iPhone','Safari/604.1','iPhone','::ffff:127.0.0.1',1,'2025-12-16 06:39:09','2025-12-16 06:39:09','2025-12-16 06:39:09'),('7c97fbbe-8532-4ff6-8ea1-f027d8dd7a02','d895301a-35c0-42d7-80b5-70b6e340a1c0','dev-31d46564','Win32','Safari/537.36','Win32','::ffff:127.0.0.1',1,'2026-03-19 13:56:18','2026-02-08 18:08:55','2026-03-19 13:56:18'),('835f1488-c057-426a-a84f-770780ce3dde','d895301a-35c0-42d7-80b5-70b6e340a1c0','dev-22f58303','Win32','Safari/537.36','Win32','::ffff:127.0.0.1',1,'2026-01-10 12:51:31','2025-12-15 20:58:23','2026-01-10 12:51:31'),('93e097ae-a8d1-4e57-8690-bb164392910c','d895301a-35c0-42d7-80b5-70b6e340a1c0','dev-ca870a21','Linux armv81','Safari/537.36','Linux armv81','::ffff:127.0.0.1',1,'2026-02-26 02:00:14','2026-02-16 18:03:21','2026-02-26 02:00:14'),('9ff1fa2a-7988-4600-acc3-ebc24403c55e','d895301a-35c0-42d7-80b5-70b6e340a1c0','dev-d42e9e47','Win32','Safari/537.36','Win32','::ffff:127.0.0.1',1,'2026-03-18 18:12:33','2026-02-19 06:46:52','2026-03-18 18:12:33'),('b5b2e0b6-ffb5-4d6f-8777-a4b0188081fe','f58c195d-a769-44a2-b0be-e990716da38b','dev-3ad8ab43','Linux armv81','Safari/537.36','Linux armv81','::ffff:127.0.0.1',1,'2025-12-27 11:25:23','2025-12-16 06:32:51','2025-12-27 11:25:23'),('ccff6eb3-9f5e-4f9b-b365-f1f0cec72f8e','f58c195d-a769-44a2-b0be-e990716da38b','dev-ca870a21','Linux armv81','Safari/537.36','Linux armv81','::ffff:127.0.0.1',1,'2026-02-09 16:51:35','2026-02-09 16:51:35','2026-02-09 16:51:35'),('d938f72f-3f56-498d-97b5-66d7abd71756','d895301a-35c0-42d7-80b5-70b6e340a1c0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36-1765831741689','Win32','Safari/537.36','Win32','::ffff:127.0.0.1',1,'2025-12-15 20:49:01','2025-12-15 20:49:01','2025-12-15 20:49:01'),('f6b6f9a5-d288-4f6e-9f52-0479c3088d7b','f58c195d-a769-44a2-b0be-e990716da38b','dev-15fcefa6','Linux armv81','Safari/537.36','Linux armv81','::ffff:127.0.0.1',1,'2025-12-25 08:30:01','2025-12-17 13:05:38','2025-12-25 08:30:01');
/*!40000 ALTER TABLE `admin_devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_email_verifications`
--

DROP TABLE IF EXISTS `admin_email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_email_verifications` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `admin_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `verification_code` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified` tinyint(1) DEFAULT '0',
  `verified_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `attempts` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_user_verification` (`admin_user_id`),
  KEY `idx_verification_code` (`verification_code`),
  KEY `idx_email` (`email`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `admin_email_verifications_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_email_verifications`
--

LOCK TABLES `admin_email_verifications` WRITE;
/*!40000 ALTER TABLE `admin_email_verifications` DISABLE KEYS */;
INSERT INTO `admin_email_verifications` VALUES ('2157e054-7cac-4565-8306-99cfe88b7a35','8db65c65-6fee-4199-8b20-5b982bf60587','162301','resendtest1765830241@example.com',0,NULL,'2025-12-15 20:54:02',0,'2025-12-15 20:24:02'),('39139a71-992d-4f92-8615-a15b9815f0e1','d895301a-35c0-42d7-80b5-70b6e340a1c0','580007','sprsinfotech@gmail.com',1,'2025-12-15 20:37:18','2025-12-15 21:03:43',0,'2025-12-15 20:33:43'),('468837c1-c4b3-4290-8566-a33b14064f26','f58c195d-a769-44a2-b0be-e990716da38b','667327','suimfx01@gmail.com',1,'2025-12-16 06:32:22','2025-12-16 07:01:22',0,'2025-12-16 06:31:21'),('858e4f82-109b-45ef-8a4f-62a68f14d5d0','d895301a-35c0-42d7-80b5-70b6e340a1c0','877623','sprsinfotech@gmail.com',1,'2025-12-15 20:47:53','2025-12-15 21:17:28',0,'2025-12-15 20:47:28'),('b6a2b66d-1454-4777-a997-bfe83890fd84','8db65c65-6fee-4199-8b20-5b982bf60587','128321','resendtest1765830241@example.com',0,NULL,'2025-12-15 20:54:01',0,'2025-12-15 20:24:01'),('cf2ded63-e427-4bee-9383-07d9065e322a','d895301a-35c0-42d7-80b5-70b6e340a1c0','425121','sprsinfotech@gmail.com',1,'2025-12-15 20:21:20','2025-12-15 20:48:35',0,'2025-12-15 20:18:34');
/*!40000 ALTER TABLE `admin_email_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_password_resets`
--

DROP TABLE IF EXISTS `admin_password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_password_resets` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `admin_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `temp_password` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `temp_password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_user_reset` (`admin_user_id`),
  KEY `idx_email` (`email`),
  KEY `idx_used` (`used`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `admin_password_resets_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_password_resets`
--

LOCK TABLES `admin_password_resets` WRITE;
/*!40000 ALTER TABLE `admin_password_resets` DISABLE KEYS */;
INSERT INTO `admin_password_resets` VALUES ('1db06e0c-0b05-40d5-9a28-dc2075058213','f58c195d-a769-44a2-b0be-e990716da38b','suimfx01@gmail.com','dx6$Yh%5jY7F','$2a$10$ftaykgfZZwizKBeRmBgMS.Mu4FlH9qEyb6pwVzPOhoQCdWQdF/UUa',1,'2026-02-09 16:51:14','2026-02-09 17:06:03','::1','2026-02-09 16:51:02');
/*!40000 ALTER TABLE `admin_password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_sessions`
--

DROP TABLE IF EXISTS `admin_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_sessions` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `admin_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_locked` tinyint(1) DEFAULT '0',
  `locked_at` timestamp NULL DEFAULT NULL,
  `last_activity_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `device_id` (`device_id`),
  KEY `idx_admin_user_session` (`admin_user_id`),
  KEY `idx_token` (`token`),
  KEY `idx_is_locked` (`is_locked`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `admin_sessions_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_sessions_ibfk_2` FOREIGN KEY (`device_id`) REFERENCES `admin_devices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_sessions`
--

LOCK TABLES `admin_sessions` WRITE;
/*!40000 ALTER TABLE `admin_sessions` DISABLE KEYS */;
INSERT INTO `admin_sessions` VALUES ('3102d5ed-af7d-456b-be08-bf22b08f8fb5','d895301a-35c0-42d7-80b5-70b6e340a1c0','93e097ae-a8d1-4e57-8690-bb164392910c','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MTI2NTAwMSwiZXhwIjoxNzcxMzUxNDAxfQ.Es1A3AjWRySX9v5rGhJoAR1fg-Zy6finoPaQLJlu50o','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcxMjY1MDAxLCJleHAiOjE3NzE4Njk4MDF9.3X45680BI15lVj3cx-oHawiAgQtFABRLvrZt4kYmNUU',0,NULL,'2026-02-16 18:03:21','2026-02-17 18:03:21','::ffff:127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','2026-02-16 18:03:21'),('4db94d2f-f73a-482c-9c39-2e8e49ccab7f','d895301a-35c0-42d7-80b5-70b6e340a1c0','7c97fbbe-8532-4ff6-8ea1-f027d8dd7a02','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MzkyODU3OCwiZXhwIjoxNzc0MDE0OTc4fQ.eWwRHIO3vLavRHH3iETu4jKC-B57e7KptQKWIMqOnv0','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczOTI4NTc4LCJleHAiOjE3NzQ1MzMzNzh9.aBaCRWvwNf6SJtjmcRP1StOtlvq8rBj9bJEcWWQTAS0',0,'2026-03-19 15:28:19','2026-03-19 15:30:50','2026-03-20 13:56:18','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-03-19 13:56:18'),('56ba7843-dcb4-4f4b-b4e1-f1167b212e1e','d895301a-35c0-42d7-80b5-70b6e340a1c0','93e097ae-a8d1-4e57-8690-bb164392910c','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MjA3MTIxNCwiZXhwIjoxNzcyMTU3NjE0fQ.imxQGopwZPau5gkwwpuR-LcJCTqGNbxvjR17am4rPa0','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcyMDcxMjE0LCJleHAiOjE3NzI2NzYwMTR9.NOkF0aWL5LXRnp9lt20GHdKlwbCN6nJpnIwcNs7U4d4',0,NULL,'2026-02-26 19:00:19','2026-02-27 02:00:14','::ffff:127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-02-26 02:00:14'),('7e1e554f-62c1-45f8-9edc-285abfbfc73a','d895301a-35c0-42d7-80b5-70b6e340a1c0','93e097ae-a8d1-4e57-8690-bb164392910c','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MTg2NzA2MiwiZXhwIjoxNzcxOTUzNDYyfQ.sosrY9gNaIvSanojI1A7flG-QGS-_N1GMIFQbxS_2eM','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcxODY3MDYyLCJleHAiOjE3NzI0NzE4NjJ9.DOgecWPM4byic9UIEif9QeQqaFFszM35tckbGIZGMt8',1,'2026-02-23 17:25:23','2026-02-23 17:20:28','2026-02-24 17:17:42','::ffff:127.0.0.1','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36','2026-02-23 17:17:42'),('92cd2c6f-1663-470b-a785-028bb6872968','d895301a-35c0-42d7-80b5-70b6e340a1c0','93e097ae-a8d1-4e57-8690-bb164392910c','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MTM1Njk0OSwiZXhwIjoxNzcxNDQzMzQ5fQ.nwDRDaPrxleSQ9A38HTgeGN5uhjwdGACrd_ZyQDxEWE','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcxMzU2OTQ5LCJleHAiOjE3NzE5NjE3NDl9.FSF-BpjRkWuE-aehbnL1RAFgpovgjajwSfKU5rAyMBc',0,NULL,'2026-02-17 19:39:28','2026-02-18 19:35:50','::ffff:127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','2026-02-17 19:35:49'),('bfe08aef-8f43-409b-a1a1-5f67f291bdcf','f58c195d-a769-44a2-b0be-e990716da38b','ccff6eb3-9f5e-4f9b-b365-f1f0cec72f8e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY1OGMxOTVkLWE3NjktNDRhMi1iMGJlLWU5OTA3MTZkYTM4YiIsImVtYWlsIjoic3VpbWZ4MDFAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzcwNjU1ODk1LCJleHAiOjE3NzA3NDIyOTV9.LkTWBfqEqruEtaWmTggpJ567gpxXQQVyZ1hE6Pm5rzw','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY1OGMxOTVkLWE3NjktNDRhMi1iMGJlLWU5OTA3MTZkYTM4YiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcwNjU1ODk1LCJleHAiOjE3NzEyNjA2OTV9.NJv-1WxNTOOUDOSytWUvTa7XYnxFtdRqkPoYDL0LsTQ',0,NULL,'2026-02-09 16:55:42','2026-02-10 16:51:35','::ffff:127.0.0.1','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36','2026-02-09 16:51:35'),('c0601c84-17f0-4956-a995-c07edc9153fd','d895301a-35c0-42d7-80b5-70b6e340a1c0','7c97fbbe-8532-4ff6-8ea1-f027d8dd7a02','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MTAwOTA2OSwiZXhwIjoxNzcxMDk1NDY5fQ.zHg4vANSGf4XILyyGdkkTgmO0WOjsjaqE4nsyl5dAdU','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcxMDA5MDY5LCJleHAiOjE3NzE2MTM4Njl9.RS5Hxn_YFhheUnK-bWPLNwRkouIo0mUKfPGCS2KUeJw',1,'2026-02-13 19:07:59','2026-02-13 19:04:49','2026-02-14 18:57:49','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','2026-02-13 18:57:49'),('d33908de-0a5f-4ce7-b9a7-389a47759158','d895301a-35c0-42d7-80b5-70b6e340a1c0','9ff1fa2a-7988-4600-acc3-ebc24403c55e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3Mzg1NzU1MywiZXhwIjoxNzczOTQzOTUzfQ.SIZ3z4QVNOhRvgewnB4zL_DvMdnv3PTBrnsDqk7S50w','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczODU3NTUzLCJleHAiOjE3NzQ0NjIzNTN9.6tfZvRcrOMnjDXKLs_EFtdLEsfjhUEUdSNjL7r3Yf34',1,'2026-03-18 19:15:22','2026-03-18 19:12:18','2026-03-19 18:12:33','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-03-18 18:12:33'),('e2bbcbac-757f-49fe-99b1-a5b78e175fc5','d895301a-35c0-42d7-80b5-70b6e340a1c0','7c97fbbe-8532-4ff6-8ea1-f027d8dd7a02','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MDY1NTg5NywiZXhwIjoxNzcwNzQyMjk3fQ.13HdICcHgPxvPl6tIM_p4BCKxkz7nwYPUW0Cnu7wvuo','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcwNjU1ODk3LCJleHAiOjE3NzEyNjA2OTd9.FWdIJv_zZme24JuyFjmqZChW_dsDV28WNRe1aIvos7w',0,NULL,'2026-02-09 16:51:38','2026-02-10 16:51:37','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','2026-02-09 16:51:37'),('e737b751-25a2-493d-a790-dfd9b10b769b','d895301a-35c0-42d7-80b5-70b6e340a1c0','9ff1fa2a-7988-4600-acc3-ebc24403c55e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3Mzc0MzY4NywiZXhwIjoxNzczODMwMDg3fQ.kLphyP5phXavMXtwvk45iVU34JJF98pyspAJidx_iVs','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczNzQzNjg3LCJleHAiOjE3NzQzNDg0ODd9.9c4vwhive46xkxmS1rXlt-PGIKganF10CmIs6pZIDlQ',1,'2026-03-17 10:42:39','2026-03-17 10:34:47','2026-03-18 10:34:47','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','2026-03-17 10:34:47'),('fd8b4403-7159-49ba-9111-2db9b2277f45','d895301a-35c0-42d7-80b5-70b6e340a1c0','9ff1fa2a-7988-4600-acc3-ebc24403c55e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsImVtYWlsIjoic3Byc2luZm90ZWNoQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MTQ4MzYxMiwiZXhwIjoxNzcxNTcwMDEyfQ.WYhcMPkYlsS3eDhVASsY1XJ0yKsRAO0wpLqktWMHan4','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4OTUzMDFhLTM1YzAtNDJkNy04MGI1LTcwYjZlMzQwYTFjMCIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzcxNDgzNjEyLCJleHAiOjE3NzIwODg0MTJ9.zc9XxAQmLN_g0sX10J-oHzn_u7pkOB-gfV_j0wxQaw4',1,'2026-02-19 07:34:46','2026-02-19 07:30:33','2026-02-20 06:46:52','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','2026-02-19 06:46:52');
/*!40000 ALTER TABLE `admin_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','active','suspended','blocked') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `email_verified` tinyint(1) DEFAULT '0',
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_email_verified` (`email_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES ('8db65c65-6fee-4199-8b20-5b982bf60587','resendtest1765830241@example.com','$2a$10$yi1Kbaf68rdVjEdU0fgmLumgM.H61n24CTA8Z4TM8s9wJyMwVpvw.','Test','User','pending',0,NULL,'2025-12-15 20:24:01','2025-12-15 20:24:01'),('d895301a-35c0-42d7-80b5-70b6e340a1c0','sprsinfotech@gmail.com','$2a$10$vuiVGYVbxmEAdKxHix6SpugGtxHTIdPiqPde/ViRZR9sUPamnXkeu','admin',NULL,'active',1,'2026-03-19 13:56:18','2025-12-15 20:18:34','2026-03-19 13:56:18'),('f58c195d-a769-44a2-b0be-e990716da38b','suimfx01@gmail.com','$2a$10$ZUxxdt7u4Vjl1Lwel3DuQO2P3t.0NPQm/NcIhcFQz6oz1Ud75WSEi','Adminboss',NULL,'active',1,'2026-02-09 16:51:35','2025-12-16 06:31:21','2026-02-09 16:51:35');
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_keys`
--

DROP TABLE IF EXISTS `api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_key` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `enabled` tinyint(1) DEFAULT '0',
  `endpoint` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `provider` (`provider`),
  KEY `idx_provider` (`provider`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=1357 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_keys`
--

LOCK TABLES `api_keys` WRITE;
/*!40000 ALTER TABLE `api_keys` DISABLE KEYS */;
INSERT INTO `api_keys` VALUES (1,'finnhub','REPLACE_WITH_YOUR_FINNHUB_API_KEY',0,'wss://ws.finnhub.io','Finnhub WebSocket for stocks','2025-12-27 16:53:14','2025-12-27 17:09:24'),(2,'twelvedata','40298686d2194b2087b87482f786e6b8',1,'wss://ws.twelvedata.com/v1/quotes/price','TwelveData WebSocket for forex/metals','2025-12-27 16:53:14','2025-12-27 16:58:22'),(3,'binance','',0,'wss://stream.binance.com:9443/ws','Binance WebSocket for crypto','2025-12-27 16:53:14','2025-12-27 16:53:14');
/*!40000 ALTER TABLE `api_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `resource_type` varchar(100) DEFAULT NULL,
  `resource_id` varchar(36) DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_accounts`
--

DROP TABLE IF EXISTS `bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_accounts` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `account_holder` varchar(255) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `swift_code` varchar(20) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_account` (`user_id`,`account_number`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `bank_accounts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_accounts`
--

LOCK TABLES `bank_accounts` WRITE;
/*!40000 ALTER TABLE `bank_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `bank_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `beneficiaries`
--

DROP TABLE IF EXISTS `beneficiaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `beneficiaries` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('bank','crypto') COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wallet_address` text COLLATE utf8mb4_unicode_ci,
  `wallet_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chain_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ifsc_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `beneficiaries`
--

LOCK TABLES `beneficiaries` WRITE;
/*!40000 ALTER TABLE `beneficiaries` DISABLE KEYS */;
/*!40000 ALTER TABLE `beneficiaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fund_requests`
--

DROP TABLE IF EXISTS `fund_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fund_requests` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `account_id` varchar(36) DEFAULT NULL,
  `type` enum('deposit','withdrawal') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` enum('bank','card','crypto','wallet') NOT NULL,
  `status` enum('pending','processing','completed','failed','rejected') DEFAULT 'pending',
  `reference_number` varchar(100) DEFAULT NULL,
  `gateway_response` json DEFAULT NULL,
  `bank_account_id` varchar(36) DEFAULT NULL,
  `crypto_address` varchar(255) DEFAULT NULL,
  `crypto_chain` varchar(50) DEFAULT NULL,
  `transaction_hash` varchar(255) DEFAULT NULL,
  `notes` text,
  `screenshot_path` varchar(255) DEFAULT NULL,
  `created_by_user` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `failed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `bank_account_id` (`bank_account_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fund_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fund_requests_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fund_requests_ibfk_3` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fund_requests`
--

LOCK TABLES `fund_requests` WRITE;
/*!40000 ALTER TABLE `fund_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `fund_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ib_clients`
--

DROP TABLE IF EXISTS `ib_clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ib_clients` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `ib_id` varchar(36) NOT NULL,
  `client_user_id` varchar(36) NOT NULL,
  `status` enum('active','inactive','referred') DEFAULT 'referred',
  `lifetime_volume` decimal(20,2) DEFAULT '0.00',
  `lifetime_commission` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_ib_client` (`ib_id`,`client_user_id`),
  KEY `idx_ib_id` (`ib_id`),
  KEY `idx_client_user_id` (`client_user_id`),
  CONSTRAINT `ib_clients_ibfk_1` FOREIGN KEY (`ib_id`) REFERENCES `ib_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ib_clients_ibfk_2` FOREIGN KEY (`client_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ib_clients`
--

LOCK TABLES `ib_clients` WRITE;
/*!40000 ALTER TABLE `ib_clients` DISABLE KEYS */;
/*!40000 ALTER TABLE `ib_clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ib_commissions`
--

DROP TABLE IF EXISTS `ib_commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ib_commissions` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `ib_id` varchar(36) NOT NULL,
  `client_id` varchar(36) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `status` enum('pending','completed','paid') DEFAULT 'pending',
  `paid_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  KEY `idx_ib_id` (`ib_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `ib_commissions_ibfk_1` FOREIGN KEY (`ib_id`) REFERENCES `ib_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ib_commissions_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `ib_clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ib_commissions`
--

LOCK TABLES `ib_commissions` WRITE;
/*!40000 ALTER TABLE `ib_commissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `ib_commissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ib_profiles`
--

DROP TABLE IF EXISTS `ib_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ib_profiles` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `ib_id` varchar(50) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `referral_link` varchar(255) DEFAULT NULL,
  `status` enum('active','suspended','closed') DEFAULT 'active',
  `commission_structure` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `ib_id` (`ib_id`),
  UNIQUE KEY `referral_link` (`referral_link`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_ib_id` (`ib_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `ib_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ib_profiles`
--

LOCK TABLES `ib_profiles` WRITE;
/*!40000 ALTER TABLE `ib_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `ib_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kyc_documents`
--

DROP TABLE IF EXISTS `kyc_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_documents` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `document_type` varchar(50) DEFAULT NULL,
  `document_url` varchar(255) DEFAULT NULL,
  `document_number` varchar(100) DEFAULT NULL,
  `issue_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `status` enum('pending','approved','rejected','expired') DEFAULT 'pending',
  `rejection_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `kyc_documents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kyc_documents`
--

LOCK TABLES `kyc_documents` WRITE;
/*!40000 ALTER TABLE `kyc_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mam_accounts`
--

DROP TABLE IF EXISTS `mam_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mam_accounts` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `manager_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `balance` decimal(15,2) DEFAULT '0.00',
  `equity` decimal(15,2) DEFAULT '0.00',
  `status` enum('active','paused','closed') DEFAULT 'active',
  `target_balance` decimal(15,2) DEFAULT NULL,
  `risk_level` enum('low','medium','high') DEFAULT 'medium',
  `max_drawdown` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_manager_id` (`manager_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `mam_accounts_ibfk_1` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mam_accounts`
--

LOCK TABLES `mam_accounts` WRITE;
/*!40000 ALTER TABLE `mam_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `mam_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mam_subscriptions`
--

DROP TABLE IF EXISTS `mam_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mam_subscriptions` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `investor_id` varchar(36) NOT NULL,
  `master_account_id` varchar(36) NOT NULL,
  `slave_account_id` varchar(36) DEFAULT NULL,
  `risk_multiplier` decimal(5,4) DEFAULT '1.0000',
  `status` enum('active','paused','cancelled') DEFAULT 'active',
  `investment_amount` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_investor_id` (`investor_id`),
  KEY `idx_master_account_id` (`master_account_id`),
  CONSTRAINT `mam_subscriptions_ibfk_1` FOREIGN KEY (`investor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mam_subscriptions_ibfk_2` FOREIGN KEY (`master_account_id`) REFERENCES `mam_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mam_subscriptions`
--

LOCK TABLES `mam_subscriptions` WRITE;
/*!40000 ALTER TABLE `mam_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `mam_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_preferences`
--

DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_preferences` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `email_notifications` tinyint(1) DEFAULT '1',
  `sms_notifications` tinyint(1) DEFAULT '0',
  `push_notifications` tinyint(1) DEFAULT '1',
  `trading_alerts` tinyint(1) DEFAULT '1',
  `market_news` tinyint(1) DEFAULT '1',
  `deposit_alerts` tinyint(1) DEFAULT '1',
  `withdrawal_alerts` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `notification_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_preferences`
--

LOCK TABLES `notification_preferences` WRITE;
/*!40000 ALTER TABLE `notification_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text,
  `icon` varchar(50) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `action_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `account_id` varchar(36) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `side` enum('BUY','SELL') NOT NULL,
  `volume` decimal(10,4) NOT NULL,
  `order_type` enum('Market','Limit','Stop') NOT NULL,
  `price` decimal(15,8) DEFAULT NULL,
  `stop_loss` decimal(15,8) DEFAULT NULL,
  `take_profit` decimal(15,8) DEFAULT NULL,
  `status` enum('pending','executed','cancelled','expired') DEFAULT 'pending',
  `leverage` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `executed_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_status` (`status`),
  KEY `idx_symbol` (`symbol`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pamm_accounts`
--

DROP TABLE IF EXISTS `pamm_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pamm_accounts` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `manager_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `aum` decimal(15,2) DEFAULT '0.00',
  `status` enum('active','paused','closed') DEFAULT 'active',
  `min_investment` decimal(15,2) DEFAULT '100.00',
  `management_fee` decimal(5,3) DEFAULT '0.000',
  `performance_fee` decimal(5,3) DEFAULT '0.000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_manager_id` (`manager_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `pamm_accounts_ibfk_1` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pamm_accounts`
--

LOCK TABLES `pamm_accounts` WRITE;
/*!40000 ALTER TABLE `pamm_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `pamm_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pamm_investments`
--

DROP TABLE IF EXISTS `pamm_investments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pamm_investments` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `investor_id` varchar(36) NOT NULL,
  `pamm_account_id` varchar(36) NOT NULL,
  `investment_amount` decimal(15,2) NOT NULL,
  `units` decimal(15,8) DEFAULT NULL,
  `status` enum('active','withdrawn','closed') DEFAULT 'active',
  `current_value` decimal(15,2) DEFAULT NULL,
  `profit` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `withdrawn_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_investor_id` (`investor_id`),
  KEY `idx_pamm_account_id` (`pamm_account_id`),
  CONSTRAINT `pamm_investments_ibfk_1` FOREIGN KEY (`investor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pamm_investments_ibfk_2` FOREIGN KEY (`pamm_account_id`) REFERENCES `pamm_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pamm_investments`
--

LOCK TABLES `pamm_investments` WRITE;
/*!40000 ALTER TABLE `pamm_investments` DISABLE KEYS */;
/*!40000 ALTER TABLE `pamm_investments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  KEY `idx_token` (`token`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(255) NOT NULL,
  `type` enum('bank','card','crypto','wallet','ewallet') NOT NULL,
  `countries` json DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `min_amount` decimal(15,2) DEFAULT NULL,
  `max_amount` decimal(15,2) DEFAULT NULL,
  `fee_percentage` decimal(5,3) DEFAULT NULL,
  `processing_time` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES ('35d7e87b-d6b8-11f0-866d-fabefe9bbf2d','Bank Transfer','bank',NULL,1,100.00,100000.00,0.500,'1-3 business days','2025-12-11 17:38:31'),('35d7f2a4-d6b8-11f0-866d-fabefe9bbf2d','Credit/Debit Card','card',NULL,1,10.00,10000.00,2.500,'Instant','2025-12-11 17:38:31'),('35d80673-d6b8-11f0-866d-fabefe9bbf2d','USDT (ERC20)','crypto',NULL,1,10.00,50000.00,0.100,'5-30 minutes','2025-12-11 17:38:31'),('35d808a1-d6b8-11f0-866d-fabefe9bbf2d','USDT (TRC20)','crypto',NULL,1,10.00,50000.00,0.050,'5-30 minutes','2025-12-11 17:38:31'),('35d80a4d-d6b8-11f0-866d-fabefe9bbf2d','Bitcoin','crypto',NULL,1,100.00,100000.00,0.200,'10-60 minutes','2025-12-11 17:38:31');
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_settings`
--

DROP TABLE IF EXISTS `platform_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` json DEFAULT NULL,
  `description` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `idx_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_settings`
--

LOCK TABLES `platform_settings` WRITE;
/*!40000 ALTER TABLE `platform_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `platform_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `positions`
--

DROP TABLE IF EXISTS `positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `positions` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `account_id` varchar(36) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `side` enum('BUY','SELL') NOT NULL,
  `volume` decimal(10,4) NOT NULL,
  `open_price` decimal(15,8) NOT NULL,
  `current_price` decimal(15,8) DEFAULT NULL,
  `stop_loss` decimal(15,8) DEFAULT NULL,
  `take_profit` decimal(15,8) DEFAULT NULL,
  `profit` decimal(15,2) DEFAULT '0.00',
  `profit_percentage` decimal(10,4) DEFAULT '0.0000',
  `leverage` int DEFAULT '1',
  `commission` decimal(10,4) DEFAULT '0.0000',
  `status` enum('open','closed','pending') DEFAULT 'open',
  `open_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `close_time` timestamp NULL DEFAULT NULL,
  `closed_price` decimal(15,8) DEFAULT NULL,
  `closed_reason` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_symbol` (`symbol`),
  KEY `idx_status` (`status`),
  KEY `idx_open_time` (`open_time`),
  CONSTRAINT `positions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `positions_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `positions`
--

LOCK TABLES `positions` WRITE;
/*!40000 ALTER TABLE `positions` DISABLE KEYS */;
/*!40000 ALTER TABLE `positions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `statistics`
--

DROP TABLE IF EXISTS `statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `statistics` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `metric_name` varchar(100) DEFAULT NULL,
  `metric_value` decimal(20,2) DEFAULT NULL,
  `time_period` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_metric_name` (`metric_name`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `statistics`
--

LOCK TABLES `statistics` WRITE;
/*!40000 ALTER TABLE `statistics` DISABLE KEYS */;
/*!40000 ALTER TABLE `statistics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `style_settings`
--

DROP TABLE IF EXISTS `style_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `style_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `header_color` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'default',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `platform_font_size` varchar(32) COLLATE utf8mb4_general_ci DEFAULT 'medium',
  `button_text_color` varchar(32) COLLATE utf8mb4_general_ci DEFAULT 'white',
  `topbar_bg_color` varchar(32) COLLATE utf8mb4_general_ci DEFAULT 'default',
  `theme_mode` varchar(16) COLLATE utf8mb4_general_ci DEFAULT 'default',
  `font_color_mode` varchar(16) COLLATE utf8mb4_general_ci DEFAULT 'auto',
  `shadow_effect` varchar(16) COLLATE utf8mb4_general_ci DEFAULT 'drop',
  `glossy_effect` varchar(16) COLLATE utf8mb4_general_ci DEFAULT 'on',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `style_settings`
--

LOCK TABLES `style_settings` WRITE;
/*!40000 ALTER TABLE `style_settings` DISABLE KEYS */;
INSERT INTO `style_settings` VALUES (1,'default','2026-02-19 06:47:43','2026-03-19 15:20:05','14px','white','default','default','auto','inner','on');
/*!40000 ALTER TABLE `style_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_tickets`
--

DROP TABLE IF EXISTS `support_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `ticket_number` varchar(50) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(50) DEFAULT NULL,
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `status` enum('open','in_progress','waiting','resolved','closed') DEFAULT 'open',
  `assigned_to` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_ticket_number` (`ticket_number`),
  CONSTRAINT `support_tickets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_tickets`
--

LOCK TABLES `support_tickets` WRITE;
/*!40000 ALTER TABLE `support_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `symbols`
--

DROP TABLE IF EXISTS `symbols`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `symbols` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `code` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `digits` int DEFAULT '5',
  `min_volume` decimal(10,4) DEFAULT '0.0100',
  `max_volume` decimal(15,2) DEFAULT '100.00',
  `bid` decimal(15,8) DEFAULT NULL,
  `ask` decimal(15,8) DEFAULT NULL,
  `spread` decimal(10,8) DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `symbols`
--

LOCK TABLES `symbols` WRITE;
/*!40000 ALTER TABLE `symbols` DISABLE KEYS */;
/*!40000 ALTER TABLE `symbols` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trade_history`
--

DROP TABLE IF EXISTS `trade_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trade_history` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `account_id` varchar(36) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `side` enum('BUY','SELL') NOT NULL,
  `volume` decimal(10,4) NOT NULL,
  `open_price` decimal(15,8) NOT NULL,
  `close_price` decimal(15,8) NOT NULL,
  `profit` decimal(15,2) DEFAULT NULL,
  `profit_percentage` decimal(10,4) DEFAULT NULL,
  `commission` decimal(10,4) DEFAULT NULL,
  `leverage` int DEFAULT NULL,
  `open_time` timestamp NULL DEFAULT NULL,
  `close_time` timestamp NULL DEFAULT NULL,
  `duration_seconds` int DEFAULT NULL,
  `closed_reason` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_symbol` (`symbol`),
  KEY `idx_close_time` (`close_time`),
  CONSTRAINT `trade_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `trade_history_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trade_history`
--

LOCK TABLES `trade_history` WRITE;
/*!40000 ALTER TABLE `trade_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `trade_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trade_logs`
--

DROP TABLE IF EXISTS `trade_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trade_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trade_id` int NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `action` varchar(50) NOT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trade_id` (`trade_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  CONSTRAINT `trade_logs_ibfk_1` FOREIGN KEY (`trade_id`) REFERENCES `trades` (`id`) ON DELETE CASCADE,
  CONSTRAINT `trade_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trade_logs`
--

LOCK TABLES `trade_logs` WRITE;
/*!40000 ALTER TABLE `trade_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `trade_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trade_settings`
--

DROP TABLE IF EXISTS `trade_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trade_settings` (
  `id` tinyint NOT NULL,
  `auto_close_timeout_minutes` int NOT NULL DEFAULT '2',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trade_settings`
--

LOCK TABLES `trade_settings` WRITE;
/*!40000 ALTER TABLE `trade_settings` DISABLE KEYS */;
INSERT INTO `trade_settings` VALUES (1,5,'2026-03-16 17:13:31');
/*!40000 ALTER TABLE `trade_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trades`
--

DROP TABLE IF EXISTS `trades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `side` enum('BUY','SELL') NOT NULL,
  `volume` decimal(15,4) NOT NULL,
  `entry_price` decimal(15,6) NOT NULL,
  `current_price` decimal(15,6) DEFAULT NULL,
  `take_profit` decimal(15,6) DEFAULT NULL,
  `stop_loss` decimal(15,6) DEFAULT NULL,
  `leverage` int NOT NULL,
  `locked_balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `pnl` decimal(15,2) NOT NULL DEFAULT '0.00',
  `pnl_percentage` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `status` enum('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  `close_price` decimal(15,6) DEFAULT NULL,
  `final_pnl` decimal(15,2) DEFAULT NULL,
  `opened_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` timestamp NULL DEFAULT NULL,
  `closing_reason` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_opened_at` (`opened_at`),
  KEY `idx_closed_at` (`closed_at`),
  CONSTRAINT `trades_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trades`
--

LOCK TABLES `trades` WRITE;
/*!40000 ALTER TABLE `trades` DISABLE KEYS */;
/*!40000 ALTER TABLE `trades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `account_id` varchar(36) DEFAULT NULL,
  `type` enum('deposit','withdrawal','commission','bonus','fee','profit','loss') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `balance_before` decimal(15,2) DEFAULT NULL,
  `balance_after` decimal(15,2) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_accounts`
--

DROP TABLE IF EXISTS `user_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_accounts` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `balance` decimal(15,2) DEFAULT '0.00',
  `equity` decimal(15,2) DEFAULT '0.00',
  `margin_used` decimal(15,2) DEFAULT '0.00',
  `margin_free` decimal(15,2) DEFAULT '0.00',
  `margin_level` decimal(10,2) DEFAULT '0.00',
  `account_status` enum('active','suspended','closed') DEFAULT 'active',
  `trading_mode` enum('demo','real') DEFAULT 'demo',
  `currency` varchar(3) DEFAULT 'USD',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `locked_balance` decimal(15,2) DEFAULT '0.00',
  `available_balance` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_number` (`account_number`),
  UNIQUE KEY `unique_user_account` (`user_id`,`trading_mode`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_number` (`account_number`),
  CONSTRAINT `user_accounts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_accounts`
--

LOCK TABLES `user_accounts` WRITE;
/*!40000 ALTER TABLE `user_accounts` DISABLE KEYS */;
INSERT INTO `user_accounts` VALUES ('6800c5e3-d747-4304-a9de-fc89e795493e','59147b2a-a269-4dda-b9d8-5ceaa6daf105','REAL-59147B2A',0.00,0.00,0.00,0.00,0.00,'active','real','USD','2026-03-19 10:27:59','2026-03-19 10:27:59',0.00,0.00),('f9027bd4-51c7-475d-ad42-1e28d701cb6d','59147b2a-a269-4dda-b9d8-5ceaa6daf105','DEMO-59147B2A',10000.00,10000.00,0.00,10000.00,0.00,'active','demo','USD','2026-03-19 10:27:59','2026-03-19 10:27:59',0.00,0.00);
/*!40000 ALTER TABLE `user_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_profiles`
--

DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profiles` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `profile_picture` varchar(500) DEFAULT NULL,
  `kyc_status` enum('pending','approved','rejected','expired') DEFAULT 'pending',
  `account_type` enum('standard','professional','vip') DEFAULT 'standard',
  `leverage` int DEFAULT '500',
  `selected_trading_mode` enum('demo','real') DEFAULT 'demo',
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `nationality` varchar(100) DEFAULT NULL,
  `id_type` varchar(50) DEFAULT NULL,
  `id_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_kyc_status` (`kyc_status`),
  CONSTRAINT `user_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_profiles`
--

LOCK TABLES `user_profiles` WRITE;
/*!40000 ALTER TABLE `user_profiles` DISABLE KEYS */;
INSERT INTO `user_profiles` VALUES ('12b67f18-acd9-4bef-b68c-d6963586bf4d','59147b2a-a269-4dda-b9d8-5ceaa6daf105',NULL,'pending','standard',500,'real',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-03-19 10:27:59','2026-03-19 10:32:28');
/*!40000 ALTER TABLE `user_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `country_code` varchar(2) DEFAULT NULL,
  `status` enum('active','suspended','banned','pending') DEFAULT 'pending',
  `email_verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('59147b2a-a269-4dda-b9d8-5ceaa6daf105','test@gmail.com','$2b$10$KXsaEUDQiNIAYNgDBvqdy.4Jepr9TLlDFuhSECpsmUQV6K90N.W.q','Test1','User',NULL,NULL,'active',0,'2026-03-19 10:27:59','2026-03-19 15:00:30');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!50112 SET @disable_bulk_load = IF (@is_rocksdb_supported, 'SET SESSION rocksdb_bulk_load = @old_rocksdb_bulk_load', 'SET @dummy_rocksdb_bulk_load = 0') */;
/*!50112 PREPARE s FROM @disable_bulk_load */;
/*!50112 EXECUTE s */;
/*!50112 DEALLOCATE PREPARE s */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-21 17:13:25
