package fr.openbook.api.migration;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * Merges orphan leading progress-only reading cycles (created when a Bookmory timer
 * started slightly before read.start was recorded) into the immediately following cycle
 * that begins with a start session (session_type = 0).
 */
public class MergeLeadingOrphanProgressCyclesChange implements CustomTaskChange {

    private record CycleSummary(
            int id,
            int userId,
            int bookId,
            boolean isCommon,
            Timestamp startedAt,
            Timestamp endedAt,
            int startCount,
            int endCount,
            int totalCount
    ) {}

    @Override
    public void execute(Database database) throws CustomChangeException {
        try {
            JdbcConnection jdbcConnection = (JdbcConnection) database.getConnection();
            mergeConnection(jdbcConnection.getUnderlyingConnection());
        } catch (Exception ex) {
            throw new CustomChangeException("Failed to merge orphan leading progress cycles", ex);
        }
    }

    public static int mergeConnection(Connection conn) throws SQLException {
        String selectSql = """
            SELECT
                rc.id,
                rc.user_id,
                rc.book_id,
                rc.is_common,
                rc.started_at,
                rc.ended_at,
                SUM(CASE WHEN rs.session_type = 0 THEN 1 ELSE 0 END) AS start_count,
                SUM(CASE WHEN rs.session_type = 2 THEN 1 ELSE 0 END) AS end_count,
                COUNT(rs.id) AS total_count
            FROM reading_cycle rc
            LEFT JOIN reading_session rs ON rs.reading_cycle_id = rc.id
            GROUP BY rc.id, rc.user_id, rc.book_id, rc.is_common, rc.started_at, rc.ended_at
            ORDER BY rc.user_id ASC, rc.book_id ASC, rc.id ASC
        """;

        List<CycleSummary> cycles = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(selectSql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                cycles.add(new CycleSummary(
                        rs.getInt("id"),
                        rs.getInt("user_id"),
                        rs.getInt("book_id"),
                        rs.getBoolean("is_common"),
                        rs.getTimestamp("started_at"),
                        rs.getTimestamp("ended_at"),
                        rs.getInt("start_count"),
                        rs.getInt("end_count"),
                        rs.getInt("total_count")
                ));
            }
        }

        int merged = 0;
        String moveSessionsSql = "UPDATE reading_session SET reading_cycle_id = ? WHERE reading_cycle_id = ?";
        String updateCycleSql = "UPDATE reading_cycle SET started_at = ?, is_common = ? WHERE id = ?";
        String deleteCycleSql = "DELETE FROM reading_cycle WHERE id = ?";

        try (PreparedStatement movePs = conn.prepareStatement(moveSessionsSql);
             PreparedStatement updatePs = conn.prepareStatement(updateCycleSql);
             PreparedStatement deletePs = conn.prepareStatement(deleteCycleSql)) {

            for (int i = 0; i < cycles.size() - 1; i++) {
                CycleSummary curr = cycles.get(i);
                CycleSummary next = cycles.get(i + 1);

                boolean sameUserBook = curr.userId() == next.userId() && curr.bookId() == next.bookId();
                boolean currIsLeadingProgressOnly = curr.endedAt() == null
                        && curr.totalCount() > 0
                        && curr.startCount() == 0
                        && curr.endCount() == 0;
                boolean nextHasStart = next.startCount() > 0;

                if (sameUserBook && currIsLeadingProgressOnly && nextHasStart) {
                    movePs.setInt(1, next.id());
                    movePs.setInt(2, curr.id());
                    movePs.executeUpdate();

                    Timestamp earliestStart = curr.startedAt().before(next.startedAt())
                            ? curr.startedAt()
                            : next.startedAt();
                    boolean combinedCommon = curr.isCommon() || next.isCommon();

                    updatePs.setTimestamp(1, earliestStart);
                    updatePs.setBoolean(2, combinedCommon);
                    updatePs.setInt(3, next.id());
                    updatePs.executeUpdate();

                    deletePs.setInt(1, curr.id());
                    deletePs.executeUpdate();
                    merged++;
                }
            }
        }

        return merged;
    }

    @Override
    public String getConfirmationMessage() {
        return "Merged orphan leading progress-only reading cycles into their following reading cycles";
    }

    @Override
    public void setUp() throws SetupException {
    }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}
