# Saka

Saka is a mobile app designed for hikers, explorers, and nature lovers. It combines outdoor adventure, wildlife discovery, and personal safety in one experience, helping users explore the outdoors with more confidence and awareness.

## What the app does

Saka helps people:
- Discover trails, viewpoints, and mountain locations
- Learn about local species and wildlife through search and identification features
- Check weather and location-based information before and during a trip
- Stay safer while hiking with GPS tracking, emergency support, and offline-friendly functionality
- Keep a personal record of discoveries and outdoor experiences

## Main features

- Hiking and exploration support for outdoor trips
- Viewpoint and mountain information for planning routes
- Species search and discovery tools for nature observation
- Weather and location insights for trip readiness
- Safety tools including live location tracking and emergency assistance
- User account features such as login, profile, and settings

## Current offline behavior

After the app has loaded data online, Home, MountainTop, and Viewpoint can use
saved mountain, trail-stop, and viewpoint details. Bundled mountain maps, the
available bundled viewpoint images, and Home videos work without a connection.
Saved trail data displays its last-updated date.

GPS tracking keeps a local history and a persistent upload queue for locations
that could not be sent. Journal entries and their photos are saved on-device
first, then synced automatically; pending or failed entries can be retried, and
conflicting edits retain the local version with a notice. Text messages,
profile/avatar updates, and Sakagram likes are queued for automatic sync. Text
messages are queued as text only; photos are not queued in chat. Sakagram can
show its cached feed and pending public journal photos, but comments are not
implemented. Low device storage triggers a warning when saving offline photos.
Emergency alerts and live location sharing still require connectivity; the app
must not report an alert as sent when its upload fails.

## Who it is for

Saka is built for:
- Hikers and trekkers
- Nature enthusiasts and wildlife observers
- Travelers who want a simple companion for outdoor exploration
- Anyone who wants a safer and more informative hiking experience

## Technology

Saka is built with React Native and Expo, using TypeScript for a more maintainable mobile experience. It also connects to services for location, weather, and species data.

## Getting started

To run the app locally:

```bash
cd Saka
npm install
npx expo start
```

From there, you can launch it on a simulator, emulator, or physical device.
