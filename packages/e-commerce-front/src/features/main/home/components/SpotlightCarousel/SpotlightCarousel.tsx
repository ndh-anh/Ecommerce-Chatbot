"use client";
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Button,
  useMediaQuery,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useCallback, useEffect, useState } from "react";
import { useGetCarouselEventsSuspense } from "@e-commerce/api-client/endpoints/event";
import Image from "next/image";
import Link from "next/link";

export default function SpotlightCarousel({
  timeout = 5000,
}: {
  timeout?: number;
}) {
  const { data } = useGetCarouselEventsSuspense({
    query: { refetchInterval: 30000, staleTime: 15000 },
  });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const slides = data.events.filter(
    (event) =>
      event.isPublished &&
      event.showOnCarousel &&
      new Date(event.startsAt).getTime() <= now &&
      new Date(event.endsAt).getTime() > now,
  );
  const position = slides.length ? index % slides.length : 0;
  const active = slides[position];
  const next = useCallback(() => {
    if (slides.length) setIndex((value) => (value + 1) % slides.length);
  }, [slides.length]);
  useEffect(() => {
    if (!timeout || slides.length < 2 || paused || reducedMotion) return;
    const timer = setInterval(next, timeout);
    return () => clearInterval(timer);
  }, [next, timeout, slides.length, paused, reducedMotion]);
  useEffect(() => {
    const expiry = Math.min(
      ...data.events
        .flatMap((event) => [
          new Date(event.startsAt).getTime(),
          new Date(event.endsAt).getTime(),
        ])
        .filter((value) => value > now),
    );
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(expiry - Date.now() + 1, 1), 2147483647),
    );
    return () => clearTimeout(timer);
  }, [data, now]);
  // Refresh the local clock when polling brings in newly started events.
  useEffect(() => {
    setNow(Date.now());
  }, [data]);
  if (!active) return null;
  return (
    <Box
      component="section"
      aria-label="Sự kiện nổi bật"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setPaused(false);
      }}
    >
      <Box
        sx={{
          position: "relative",
          minHeight: { xs: 320, md: 440 },
          overflow: "hidden",
          bgcolor: "grey.900",
        }}
      >
        <Image
          src={active.thumbnailUrl}
          alt={active.title}
          fill
          unoptimized
          priority={position === 0}
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.18))",
          }}
        />
        <Stack
          spacing={3}
          justifyContent="center"
          sx={{
            position: "relative",
            minHeight: { xs: 320, md: 440 },
            px: { xs: 6, md: 10 },
            py: 5,
            color: "white",
            maxWidth: 850,
          }}
        >
          <Typography
            component="h2"
            variant="title"
            sx={{ fontSize: { xs: "1.8rem", md: "3rem" }, fontWeight: 700 }}
          >
            {active.title}
          </Typography>
          {active.summary && (
            <Typography
              sx={{ fontSize: { xs: "1rem", md: "1.2rem" }, maxWidth: 600 }}
            >
              {active.summary}
            </Typography>
          )}
          <Button
            component={Link}
            href={`/event/${active.slug}`}
            variant="contained"
            sx={{ alignSelf: "flex-start", px: 4, py: 1.5 }}
          >
            Xem sự kiện
          </Button>
        </Stack>
        {slides.length > 1 && (
          <>
            <IconButton
              aria-label="Sự kiện trước"
              onClick={() =>
                setIndex((value) => (value - 1 + slides.length) % slides.length)
              }
              sx={{
                position: "absolute",
                left: 8,
                top: "50%",
                color: "white",
                bgcolor: "rgba(0,0,0,.25)",
              }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Sự kiện tiếp theo"
              onClick={next}
              sx={{
                position: "absolute",
                right: 8,
                top: "50%",
                color: "white",
                bgcolor: "rgba(0,0,0,.25)",
              }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>
      {slides.length > 1 && (
        <Stack direction="row" justifyContent="center" spacing={1} mt={1}>
          {slides.map((event, slideIndex) => (
            <IconButton
              key={event.eventId}
              aria-label={`Hiển thị sự kiện ${slideIndex + 1}: ${event.title}`}
              aria-current={slideIndex === position ? "true" : undefined}
              onClick={() => setIndex(slideIndex)}
              size="small"
            >
              <Box
                sx={{
                  width: slideIndex === position ? 26 : 10,
                  height: 10,
                  borderRadius: 99,
                  bgcolor:
                    slideIndex === position
                      ? "primary.main"
                      : "action.disabledBackground",
                }}
              />
            </IconButton>
          ))}
        </Stack>
      )}
    </Box>
  );
}
