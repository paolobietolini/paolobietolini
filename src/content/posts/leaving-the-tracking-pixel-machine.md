---
title: Leaving the tracking pixel machine to learn C
date: 2026-06-03
lang: en
description: Lately, it feels like 90% of what stakeholders care about nowadays is just compliance gymnastics and ad-platform feeding
tags: [c, essay]
---

## Introduction

Today, June 3rd, I published a [post](https://www.linkedin.com/posts/paolobietolini_is-tag-management-a-commodotized-skill-activity-7467837746963812353-5n9E?utm_source=share&utm_medium=member_desktop&rcm=ACoAACXqjzgB8r4dRqOUwYYf3X66Al12Oq_yjvg) (also shared on [Reddit](https://www.reddit.com/r/GoogleTagManager/comments/1tvej11/what_gtm_setup_mistake_causes_the_most_reporting/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)):

> **Is Tag Management a commoditized skill?**
>
> I’ve been in the analytics and tracking space for almost a decade now. I know JavaScript inside out and have built highly complex tracking implementations for massive, multinational companies as an in-house specialist.
>
> But lately, it feels like 90% of what stakeholders care about nowadays is just compliance gymnastics and ad-platform feeding.
> The entire conversation has shifted to: "How can we send the absolute maximum amount of data the GDPR allows to Meta/Google?" or "We need Server-Side GTM strictly so we can bypass browser restrictions and save our ad attribution."
>
> Validating business logic? Building robust, clean data pipelines to actually understand the customer journey or improve the product? Crickets.
> Rarely do I ever see stakeholders who want to leverage this data to actually understand their business base better. It’s all just a pipeline to feed the advertising beast.
>
> Is anyone else experiencing this shift? How are you dealing with the frustration of being a highly skilled engineer whose primary job has devolved into keeping marketing pixels alive?

Those few lines aren't meant to be just a complaint. They are the start of a public conversation about a realization I’ve been sitting on for a while: data collection is no longer viewed as a foundation for business intelligence. Instead, it has become a necessary evil, existing solely to deploy tracking pixels. As a few people rightly pointed out on LinkedIn, the ad platforms move the money, so they dictate the priorities.

## The death of Web Analytics, the rise of the Ad-Feeder

Starting from that premise, I think it’s time to face the music.
For a decade, we told ourselves we were _data-driven_, that building clean, meaningful datasets was the absolute best way to scale a business.

However, the shift I’ve witnessed over the last four years tells a different story.
The death of third-party cookies and the tightening grip of privacy regulations didn't make companies hungrier for first-party behavioral insights. Instead, it panicked them.

The entire discipline of analytics has been hijacked by ad attribution. All that seems to matter now is iterating fast, bypassing browser restrictions via Server-Side environments, and feeding as much raw data as legally possible into Meta and Google's optimization algorithms. We aren't trying to understand the user anymore; we are just trying to keep the ad-delivery machine happy.

_(A quick disclaimer: I don't have hard statistical data to back this up. This observation is drawn purely from my corporate experience and the shared anecdotes of freelance colleagues. But this paradigm shift seems entirely horizontal, impacting companies of all sizes.)_

## The illusion of commoditization

To be completely honest, however, I do need to make one vital distinction about the state of the industry:

- **Basic client-side tracking is indeed commoditized.** Yes, anyone can watch a 10-minute YouTube tutorial, paste a Meta Pixel into Shopify, or set up basic Google Analytics 4 pageviews.
- **What is NOT commoditized is the engineering.** Navigating strict GDPR constraints, migrating complex enterprise setups to Server-Side environments, managing asynchronous JavaScript race conditions, and architecting data layers that don't break when the dev team pushes a site update—these remain highly specialized skills.

But here is the crux of the issue: no matter how well I know JavaScript from top to bottom, the majority of stakeholders only care whether the Facebook or LinkedIn pixel fires.

I don't want this to sound like a plea for appreciation. I don't care about getting a pat on the back. What I care about is solving the complex problems I am theoretically paid to solve. The real frustration stems from not being able to put my actual skills to use, and not being challenged to learn anything new.

To give you an idea of how bored I've been over the last year, I actually built a Model Context Protocol (MCP) server for Google Tag Manager _just_ to complicate my life and give myself an actual problem to solve.

## Let me C

Ultimately, though, I welcome this frustration. It forced me to look closely at what I actually want.

I like to program.

There, I said it. I want to write software. I honestly care very little about marketing, attribution, and tag managers—unless there is a complex system sitting underneath them.

Since January, I’ve found myself reading Kernighan and Ritchie’s _The C Programming Language_ and working through the exercises. It’s entirely removed from my current field, yet I gravitate toward it naturally. Whenever I have free time, I sit down, learn C, and write small programs.

Digging deep, I’ve realized this is what I’ve always wanted to do. I’ve spent years hovering around the edges of pure programming, perhaps held back by a sense of reverential awe or the comfort of a niche I had mastered.

I love systems and computers. For now, this is the path I want to take, with all due respect to the marketing pixels.
