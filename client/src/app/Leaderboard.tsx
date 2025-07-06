import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card";
import { useContext } from "react";
import { DBContext } from "./DBContext";

export function Leaderboard() {
    const context = useContext(DBContext);
    if (!context) {
    throw new Error('DBContext is not available');
    }
    const {
        leaderboardEntries,
    } = context;

  return (
    <Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg max-w-[400px] w-full">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-white">Rank</TableHead>
              <TableHead className="w-[100px] text-white">Username</TableHead>
              <TableHead className="text-white">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(leaderboardEntries.values()).sort((a, b) => a.rank - b.rank).map((entry) => (
              <TableRow key={String(entry.identity)}>
                <TableCell className="text-zinc-300">{entry.rank}</TableCell>
                <TableCell className="font-medium text-zinc-300">{entry.username}</TableCell>
                <TableCell className="text-zinc-300">{entry.size}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
