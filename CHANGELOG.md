# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] - 2025-10-05
- Fixed /case sell command to use item IDs instead of names
- Added complete global market system implementation:
  - /market list: List items for sale globally
  - /market buy: Purchase items from any server
  - /market search: Search global market listings
  - /market listings: View your active listings
  - /market remove: Remove your listings
- Implemented cross-server trading and economy transfers
- Added server information to market listings
- Integrated market with economy and inventory systems
- Added safeguards against self-buying and insufficient funds
- Fixed command parameter descriptions

## [1.1.1] - 2025-10-05
- Added item ID display in inventory
- Updated inventory system with unique item identifiers
- Fixed missing commands (daily, streak, market)
- Added GuildPresences intent for better user data fetching
- Fixed item merging in inventory

## [1.1.0] - 2025-10-02
- shop system
- rob mechanics
- trading
- new reaction commands

## [Unreleased]
- Repository housekeeping: add `.env.example`, GIF validator, and documentation updates.
