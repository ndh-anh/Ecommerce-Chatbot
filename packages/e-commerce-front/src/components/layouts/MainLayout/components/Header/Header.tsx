"use client";

import Stack from "@mui/material/Stack";
import NextLink from "next/link";
import GradeRoundedIcon from "@mui/icons-material/GradeRounded";
import Button from "@mui/material/Button";
import NotificationButton from "./components/NotificationButton/NotificationButton";
import { useUser } from "@/providers/UserProvider/UserProvider";
import UserMenu from "./components/UserMenu/UserMenu";
import Box from "@mui/material/Box";

const Header = () => {
  const { user, isInitialized } = useUser();

  return (
    <Box className="w-full bg-white text-gray-600 text-xs border-b border-gray-100">
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        className="max-w-7xl mx-auto px-4 md:px-8 h-10"
      >
        <Stack direction="row" spacing={1}>
          <Button
            component={NextLink}
            href="/event"
            size="small"
            color="inherit"
          >
            Sự kiện
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <NotificationButton />
          <Button
            component={NextLink}
            href="/wishlist"
            variant="text"
            startIcon={<GradeRoundedIcon sx={{ fontSize: 18 }} />}
            className="text-gray-600 hover:text-black hover:bg-gray-100 text-xs font-medium px-3"
            disableRipple
          >
            Yêu thích
          </Button>
          {isInitialized &&
            (user ? (
              <UserMenu user={user} />
            ) : (
              <>
                <Button
                  component={NextLink}
                  href="/auth/login"
                  variant="text"
                  className="text-gray-600 hover:text-black hover:bg-gray-100 text-xs font-medium px-3"
                  disableRipple
                >
                  Đăng nhập
                </Button>
                <Button
                  component={NextLink}
                  href="/auth/register"
                  variant="text"
                  className="text-gray-600 hover:text-black hover:bg-gray-100 text-xs font-medium px-3"
                  disableRipple
                >
                  Đăng ký
                </Button>
              </>
            ))}
        </Stack>
      </Stack>
    </Box>
  );
};

export default Header;
