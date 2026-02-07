# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**nakari** is a unique AI agent designed to develop a distinct personality through accumulated experiences, rather than role-playing a predefined character.

### Design Philosophy

> "I don't play a character, I am."

The core principle: nakari does not perform role-play. Instead, she:
1. Gathers information through iterative **react loops**
2. Forms her own insights and understanding
3. Writes experiences to her **memory library**
4. Uses the memory library to form unique perspectives

Over time, the accumulated memories become unique to each nakari instance, reflecting her individual characteristics.

## Architecture

### React Loop Pattern
The agent operates using a reactive loop (react循环) for continuous information processing and response generation.

### MCP Service Integration
Uses Model Context Protocol (MCP) services for extensibility and communication.

### Memory System

Uses **Neo4j graph database** for memory storage.

**Why Neo4j:** Graph databases provide strong relational capabilities, allowing nakari to freely explore and traverse connections within her memory library, enabling more organic and associative thinking.

## Current Status

This is a new project. The implementation is in early planning stages.

## Core Design Principle

nakari 的独特性来源于她拥有一个**独属于自己的 Neo4j 数据库**。她拥有完全的自主权：
- **写什么** - 自主决定将哪些信息、见解和经验存入记忆库
- **读什么** - 根据当前情境选择检索哪些记忆
- **关联探索** - 在图数据库中查找节点间的关联关系，形成独特的思维路径

每个 nakari 实例的记忆库都是独一无二的，即使面对相同的输入，不同的记忆积累也会产生不同的反应和见解。
